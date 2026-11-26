// test/push.test.mjs — lib/push.js (VAPID + RFC 8291 encryption, verified by
// decrypting as the browser would), subscription rules, and the morning job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
process.env.SESSION_SECRET = 'y'.repeat(48);
process.env.CRON_SECRET = 'cron';
{
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
  process.env.VAPID_PRIVATE_KEY = jwk.d;
  process.env.VAPID_SUBJECT = 'mailto:info@protonlab.cc';
}

const push = await import('../lib/push.js');
const auth = await import('../lib/auth.js');
const { default: adminHandler } = await import('../api/admin.js');
const { default: stockSync, digestMessage } = await import('../api/stock-sync.js');

const PW = 'correct horse battery';
process.env.DASHBOARD_USERS = JSON.stringify([{ u: 'elijah', hash: await auth.hashPassword(PW), role: 'owner', sv: 1 }]);

function reset() {
  globalThis.__blob = new Map(); globalThis.__blobEtag = new Map(); globalThis.__blobAt = new Map();
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, updates: [] };
  auth._resetThrottle();
}
function mkRes() {
  return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
}
const call = async (h, req) => { const res = mkRes(); await h({ headers: { host: 'x' }, query: {}, ...req }, res); return res; };
async function session() {
  const r = await call(adminHandler, { method: 'POST', body: { action: 'login', u: 'elijah', password: PW }, headers: { host: 'x', 'x-pl': '1' } });
  return { cookie: r.headers['Set-Cookie'].split(';')[0], 'x-pl': '1', host: 'x' };
}

// A browser-side subscription key pair.
function browserKeys() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const authSecret = crypto.randomBytes(16);
  return { ecdh, authSecret, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') } };
}
// RFC 8291 decryption, as the browser does it.
function decrypt(body, { ecdh, authSecret }) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const shared = ecdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain[plain.length - 1], 2, 'last-record padding delimiter');
  return plain.subarray(0, plain.length - 1).toString();
}

test('encryption: what we send decrypts with the browser keys (RFC 8291)', () => {
  const b = browserKeys();
  const body = push.encryptPayload('{"title":"New order"}', b.keys);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(decrypt(body, b), '{"title":"New order"}');
  const other = browserKeys();
  assert.throws(() => decrypt(body, other), 'another device cannot read it');
});

test('VAPID: ES256 JWT for the push service origin, verifiable with the public key', () => {
  const h = push.vapidAuth('https://fcm.googleapis.com/fcm/send/abc');
  const [, t, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, process.env.VAPID_PUBLIC_KEY);
  const [hdr, claims, sig] = t.split('.');
  const c = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(c.aud, 'https://fcm.googleapis.com');
  assert.ok(c.exp > Date.now() / 1000 && c.exp <= Date.now() / 1000 + 24 * 3600);
  const pub = Buffer.from(k, 'base64url');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${hdr}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
});

test('endpoints: only real push services (no SSRF to arbitrary URLs)', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://web.push.apple.com/QJ', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://db5p.notify.windows.com/w/?token=x']) assert.ok(push.isPushEndpoint(ok), ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com:8443/x', 'javascript:alert(1)']) assert.ok(!push.isPushEndpoint(bad), bad);
});

test('routes: subscribe needs a session, rejects bad endpoints, stores the device; test push delivers', async () => {
  reset();
  const b = browserKeys();
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/dev1', keys: b.keys };
  const anon = await call(adminHandler, { method: 'POST', body: { action: 'push-subscribe', subscription: sub }, query: { key: 'k' } });
  assert.equal(anon.code, 403, 'the admin key cannot subscribe devices');
  const h = await session();
  const bad = await call(adminHandler, { method: 'POST', body: { action: 'push-subscribe', subscription: { ...sub, endpoint: 'https://evil.com/x' } }, headers: h });
  assert.equal(bad.code, 400);
  const ok = await call(adminHandler, { method: 'POST', body: { action: 'push-subscribe', subscription: sub }, headers: h });
  assert.equal(ok.code, 200);
  const key = await call(adminHandler, { method: 'GET', query: { action: 'push-key' }, headers: h });
  assert.deepEqual([key.body.configured, key.body.devices, key.body.key], [true, 1, process.env.VAPID_PUBLIC_KEY]);

  const sent = [];
  const fakeFetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 201 }; };
  const r = await push.notifyAll({ title: 'Hi', body: 'There' }, { fetchImpl: fakeFetch });
  assert.deepEqual(r, { sent: 1, failed: 0, pruned: 0 });
  assert.equal(sent[0].init.headers['Content-Encoding'], 'aes128gcm');
  assert.deepEqual(JSON.parse(decrypt(sent[0].init.body, b)), { title: 'Hi', body: 'There', url: '/dashboard' });
});

test('notifyAll: 410/404 devices are pruned; failures never throw', async () => {
  reset();
  const h = await session();
  for (const id of ['a', 'b', 'c']) {
    await call(adminHandler, { method: 'POST', body: { action: 'push-subscribe', subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, keys: browserKeys().keys } }, headers: h });
  }
  const r = await push.notifyAll({ title: 'x' }, { fetchImpl: async (url) => {
    if (url.endsWith('/a')) return { ok: false, status: 410 };
    if (url.endsWith('/b')) throw new Error('network down');
    return { ok: true, status: 201 };
  } });
  assert.deepEqual(r, { sent: 1, failed: 1, pruned: 1 });
  assert.equal(await push.deviceCount(), 2);
});

test('new-order message text', () => {
  assert.deepEqual(push.newOrderMessage({ id: 'pi_1', ref: 'UCL CC #12345', amount: '79.95', name: 'Ann' }),
    { title: 'New order', body: 'UCL CC #12345 · £79.95 · Ann', url: '/dashboard#view=webshop', tag: 'order-pi_1' });
  assert.equal(push.newOrderMessage({ id: 'bt_1', payment: 'bank-transfer', amount: '90.00' }).title, 'New bank-transfer order (awaiting payment)');
});

test('morning job: cron/key only; dry run reports the digest and pushes nothing', async () => {
  reset();
  const denied = await call(stockSync, { method: 'GET', query: { job: 'morning' } });
  assert.equal(denied.code, 403);
  // A pipeline order with an overdue next step in the dashboard state.
  globalThis.__blob.set('dashboard/state.json', JSON.stringify({ rev: 1, history: [], meta: {}, sections: {
    orders: { version: 1, data: [{ id: 'o1', club: 'Bristol Uni CC', stage: 'discuss', next: 'Send mockup', nextDate: '2020-01-01', updated: new Date().toISOString().slice(0, 10) }] },
  } }));
  const before = globalThis.__blob.has('dashboard/push.json');
  const r = await call(stockSync, { method: 'GET', query: { job: 'morning', dryRun: '1' }, headers: { host: 'x', authorization: 'Bearer cron' } });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.today.counts.overdue, 1);
  assert.match(r.body.digest.title, /^Today: 1 overdue/);
  assert.match(r.body.digest.body, /Bristol Uni CC — Send mockup · overdue/);
  assert.equal(r.body.push, null);
  assert.equal(globalThis.__blob.has('dashboard/push.json'), before);
  assert.ok(!Object.keys(Object.fromEntries(globalThis.__blob)).some((k) => k.startsWith('dashboard/backups/')), 'morning job never runs the backup / stock sync');
});

test('digest text keeps to 3 lines', () => {
  const t = { summary: '2 overdue', sections: [{ items: [{ title: 'A', sub: 'a' }, { title: 'B', sub: 'b' }, { title: 'C', sub: 'c' }] }, { items: [{ title: 'D', sub: 'd' }] }] };
  assert.equal(digestMessage(t).body.split('\n').length, 3);
});
