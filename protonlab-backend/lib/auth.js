// lib/auth.js
// Login for the hosted order dashboard (/dashboard → api/admin.js?view=app).
//
// Users live in the DASHBOARD_USERS env var, a JSON array:
//   [{"u":"elijah","hash":"scrypt$16384$8$1$<salt>$<hash>","role":"owner","sv":1}]
// `hash` comes from `node scripts/hash-password.mjs` (run locally — the
// password never leaves the Mac). `role` is recorded in the session now and
// enforced later, when the first employee is added. Bumping a user's `sv`
// (session version) signs that user out everywhere.
//
// A session is a host-only cookie `pl_session=<payload>.<sig>`, payload =
// base64url JSON {u, role, sv, exp}, sig = HMAC-SHA256 with SESSION_SECRET.
// No Domain attribute, so protonlab.cc and its other subdomains never see it.
//
// authorize(req) is the single gate for every dashboard request:
//   • a valid session cookie (writes must also carry the `X-PL: 1` header —
//     CSRF guard on top of SameSite=Strict), or
//   • the legacy `?key=proton_export_key` (the old file:// dashboard, cron,
//     scripts) unless ADMIN_KEY_LEGACY=0.

import crypto from 'node:crypto';

export const COOKIE = 'pl_session';
export const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');

// ─── Passwords ───────────────────────────────────────────────────────────────

function scrypt(password, salt, { N, r, p, keylen }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key));
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64u(salt)}$${b64u(key)}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const want = fromB64u(hash);
  const got = await scrypt(password, fromB64u(salt), { N: +N, r: +r, p: +p, keylen: want.length });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function loadUsers() {
  try {
    const list = JSON.parse(process.env.DASHBOARD_USERS || '[]');
    return Array.isArray(list) ? list.filter((x) => x && x.u && x.hash) : [];
  } catch {
    return [];
  }
}

const findUser = (u) => loadUsers().find((x) => x.u.toLowerCase() === String(u || '').trim().toLowerCase());

// Dummy hash so an unknown username costs the same scrypt time as a known one.
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function checkLogin(u, password) {
  const user = findUser(u);
  const ok = await verifyPassword(password || '', user ? user.hash : DUMMY);
  return ok && user ? { u: user.u, role: user.role || 'owner', sv: user.sv || 1 } : null;
}

// ─── Login throttle ──────────────────────────────────────────────────────────
// In memory per function instance (no Blob ops, so failed logins can never
// eat the storage budget): 5 failures per IP or per username in 15 minutes →
// 429 until the window clears. On top of the ~800 ms delay per failure.
export const THROTTLE = { max: 5, windowMs: 15 * 60 * 1000 };
const fails = new Map();   // key → [timestamps]
export function clientIp(req) {
  const xf = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers?.['x-real-ip'] || '') || 'unknown';
}
const throttleKeys = (req, u) => [`ip:${clientIp(req)}`, `u:${String(u || '').trim().toLowerCase()}`];
function recent(key, now) {
  const list = (fails.get(key) || []).filter((t) => now - t < THROTTLE.windowMs);
  if (list.length) fails.set(key, list); else fails.delete(key);
  return list;
}
// → seconds to wait, or 0
export function loginRetryAfter(req, u, now = Date.now()) {
  let wait = 0;
  for (const k of throttleKeys(req, u)) {
    const list = recent(k, now);
    if (list.length >= THROTTLE.max) wait = Math.max(wait, Math.ceil((list[0] + THROTTLE.windowMs - now) / 1000));
  }
  return wait;
}
export function recordLoginFailure(req, u, now = Date.now()) {
  if (fails.size > 5000) fails.clear();   // memory guard against key spraying
  for (const k of throttleKeys(req, u)) fails.set(k, recent(k, now).concat(now));
}
export function clearLoginFailures(req, u) {
  for (const k of throttleKeys(req, u)) fails.delete(k);
}
export function _resetThrottle() { fails.clear(); }

// ─── Sessions ────────────────────────────────────────────────────────────────

function secret() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET missing or shorter than 32 characters');
  return s;
}

const sign = (payload) => b64u(crypto.createHmac('sha256', secret()).update(payload).digest());

export function makeSessionToken(user, now = Date.now()) {
  const payload = b64u(JSON.stringify({ u: user.u, role: user.role, sv: user.sv || 1, exp: now + SESSION_DAYS * 864e5 }));
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token, now = Date.now()) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  let want;
  try { want = Buffer.from(sign(payload)); } catch { return null; }
  const got = Buffer.from(sig || '');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let s;
  try { s = JSON.parse(fromB64u(payload).toString('utf8')); } catch { return null; }
  if (!s || typeof s.exp !== 'number' || s.exp < now) return null;
  if (s.exp > now + SESSION_DAYS * 864e5 + 60e3) return null;   // never longer than a fresh session
  // The user must still exist with the same session version — removing a user
  // or bumping `sv` in DASHBOARD_USERS revokes their cookies immediately.
  const user = findUser(s.u);
  if (!user || (user.sv || 1) !== s.sv) return null;
  return { u: user.u, role: user.role || 'owner' };
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers?.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function getSession(req) {
  return readSessionToken(parseCookies(req)[COOKIE]);
}

// Secure everywhere except plain-http localhost (local-server.js testing).
function isLocal(req) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(String(req.headers?.host || ''));
}

export function sessionCookie(req, token) {
  return `${COOKIE}=${token}; HttpOnly;${isLocal(req) ? '' : ' Secure;'} SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookie(req) {
  return `${COOKIE}=; HttpOnly;${isLocal(req) ? '' : ' Secure;'} SameSite=Strict; Path=/; Max-Age=0`;
}

// ─── Gate ────────────────────────────────────────────────────────────────────

// → {ok:true, via:'session'|'key', user} or {ok:false, status, error}
export function authorize(req) {
  let session = null;
  try { session = getSession(req); } catch { session = null; }
  if (session) {
    if (req.method === 'POST' && req.headers?.['x-pl'] !== '1') {
      return { ok: false, status: 403, error: 'Missing X-PL header' };
    }
    return { ok: true, via: 'session', user: session };
  }
  const key = process.env.proton_export_key;
  const legacy = process.env.ADMIN_KEY_LEGACY !== '0';
  if (legacy && key && typeof req.query?.key === 'string' && safeEqual(req.query.key, key)) {
    return { ok: true, via: 'key', user: { u: 'key', role: 'owner' } };
  }
  if (req.query?.key) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: false, status: 401, error: 'Not signed in' };
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Headers for every page the dashboard serves.
export function privatePageHeaders(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
