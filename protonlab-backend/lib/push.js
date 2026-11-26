// lib/push.js
// Web Push for the installed dashboard app — new-order alerts (api/webhook.js,
// api/bank-transfer-order.js) and the morning Today digest (api/stock-sync.js
// ?job=morning). No dependency: VAPID (RFC 8292, ES256 JWT) and the payload
// encryption (RFC 8291 "aes128gcm") are done with node:crypto.
//
// Keys: VAPID_PUBLIC_KEY (base64url, 65-byte uncompressed P-256 point),
// VAPID_PRIVATE_KEY (base64url, 32 bytes), VAPID_SUBJECT (mailto:…) —
// generate with `node scripts/vapid-keys.mjs`.
//
// Subscriptions: dashboard/push.json {subs:[{endpoint, keys:{p256dh, auth}, u, ua, at}]}
// (1 read per notification, writes only on subscribe / unsubscribe / prune).
// Endpoints must be on a known push service, so the server can never be made
// to POST to an arbitrary URL.

import crypto from 'node:crypto';
import { put, get } from '@vercel/blob';
import { isStoreConfigured } from './bank-orders.js';
import { _pendingOps as pending } from './dashboard-store.js';

export const PUSH_PATH = 'dashboard/push.json';
const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s || ''), 'base64url');

// Apple, Google (FCM), Mozilla, Microsoft (WNS).
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
export function isPushEndpoint(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch { return false; }
}

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

function vapidKeyObject() {
  const pub = fromB64u(process.env.VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 key (base64url)');
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}

// Authorization header for one push service origin.
export function vapidAuth(endpoint, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:info@protonlab.cc' }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: vapidKeyObject(), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`;
}

// RFC 8291 payload encryption (single aes128gcm record).
export function encryptPayload(payload, { p256dh, auth }, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Bad subscription keys');
  const local = ecdh || crypto.createECDH('prime256v1');
  if (!ecdh) local.generateKeys();
  const asPublic = local.getPublicKey();
  const shared = local.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);   // last-record delimiter
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// ─── subscription store ──────────────────────────────────────────────────────
async function readSubs() {
  pending.reads++;
  const r = await get(PUSH_PATH, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { subs: [] };
  const d = JSON.parse(await new Response(r.stream).text());
  return { subs: Array.isArray(d.subs) ? d.subs : [] };
}
async function writeSubs(subs) {
  pending.writes++;
  await put(PUSH_PATH, JSON.stringify({ subs }), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
}

export async function subscribe(sub, { u, ua } = {}) {
  if (!sub || !isPushEndpoint(sub.endpoint)) return { error: 'Unsupported push endpoint', status: 400 };
  const p256dh = sub.keys?.p256dh, auth = sub.keys?.auth;
  if (fromB64u(p256dh).length !== 65 || fromB64u(auth).length < 16) return { error: 'Bad subscription keys', status: 400 };
  const { subs } = await readSubs();
  const next = subs.filter((s) => s.endpoint !== sub.endpoint).concat({ endpoint: sub.endpoint, keys: { p256dh, auth }, u: u || '', ua: String(ua || '').slice(0, 120), at: new Date().toISOString() });
  await writeSubs(next.slice(-20));   // a handful of devices; oldest dropped
  return { ok: true, devices: next.filter((s) => s.u === u).length };
}

export async function unsubscribe(endpoint, { u } = {}) {
  const { subs } = await readSubs();
  const next = subs.filter((s) => !(s.endpoint === endpoint && (!u || s.u === u)));
  if (next.length !== subs.length) await writeSubs(next);
  return { ok: true };
}

export async function deviceCount(u) {
  const { subs } = await readSubs();
  return subs.filter((s) => !u || s.u === u).length;
}

// One message to every subscribed device (or one user's). Never throws.
// → {sent, failed, pruned}
export async function notifyAll({ title, body = '', url = '/dashboard', tag = '' }, { u = null, fetchImpl = globalThis.fetch } = {}) {
  const out = { sent: 0, failed: 0, pruned: 0 };
  try {
    if (!vapidConfigured() || !isStoreConfigured()) return { ...out, skipped: 'not configured' };
    const { subs } = await readSubs();
    const targets = subs.filter((s) => !u || s.u === u);
    if (!targets.length) return out;
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body).slice(0, 300), url, tag: tag || undefined });
    const dead = new Set();
    await Promise.all(targets.map(async (s) => {
      try {
        if (!isPushEndpoint(s.endpoint)) { dead.add(s.endpoint); return; }
        const res = await fetchImpl(s.endpoint, {
          method: 'POST',
          headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidAuth(s.endpoint) },
          body: encryptPayload(payload, s.keys),
        });
        if (res.status === 404 || res.status === 410) dead.add(s.endpoint);
        else if (res.ok) out.sent++;
        else out.failed++;
      } catch (err) { out.failed++; console.error('push failed', err?.message); }
    }));
    if (dead.size) { await writeSubs(subs.filter((s) => !dead.has(s.endpoint))); out.pruned = dead.size; }
  } catch (err) {
    console.error('notifyAll failed', err?.message);
  }
  return out;
}

// "New order — UCL #12345 · £79.95" for the webhook / bank-transfer order.
export function newOrderMessage(order) {
  const bank = order.payment === 'bank-transfer';
  const amount = Number(order.amount);
  const money = Number.isFinite(amount) ? `£${amount.toFixed(2)}` : '';
  return {
    title: bank ? 'New bank-transfer order (awaiting payment)' : 'New order',
    body: [order.ref || order.id, money, order.name && order.name !== 'N/A' ? order.name : ''].filter(Boolean).join(' · '),
    url: '/dashboard#view=webshop',
    tag: `order-${order.id || ''}`,
  };
}
