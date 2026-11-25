// test/dashboard.test.mjs — the hosted order dashboard's server side, offline:
// lib/auth.js (passwords, signed session cookies, the request gate),
// api/admin.js (pages behind the login, login/logout, state / state-save
// with optimistic versions) and lib/dashboard-store.js backups — Blob and
// Stripe are the in-memory test mocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
process.env.SESSION_SECRET = 'x'.repeat(48);

const auth = await import('../lib/auth.js');
const store = await import('../lib/dashboard-store.js');
const { default: adminHandler } = await import('../api/admin.js');
const { default: analyticsHandler } = await import('../api/analytics.js');

const PW = 'correct horse battery';
process.env.DASHBOARD_USERS = JSON.stringify([{ u: 'elijah', hash: await auth.hashPassword(PW), role: 'owner', sv: 1 }]);

function reset() {
  globalThis.__blob = new Map();
  globalThis.__blobEtag = new Map();
  delete process.env.ADMIN_KEY_LEGACY;
}
function mkRes() {
  return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
}
async function call(handler, { method = 'GET', query = {}, body, headers = {} } = {}) {
  const res = mkRes();
  await handler({ method, query, body, headers: { host: 'protonlab-backend.vercel.app', ...headers } }, res);
  return res;
}
const admin = (o) => call(adminHandler, o);
async function login(u = 'elijah', password = PW) {
  const r = await admin({ method: 'POST', body: { action: 'login', u, password }, headers: { 'x-pl': '1' } });
  const set = r.headers['Set-Cookie'] || '';
  return { r, cookie: set.split(';')[0] };
}

// ─── passwords + tokens ──────────────────────────────────────────────────────

test('password hashes verify and reject', async () => {
  const h = await auth.hashPassword('abc123abc123');
  assert.match(h, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await auth.verifyPassword('abc123abc123', h), true);
  assert.equal(await auth.verifyPassword('abc123abc124', h), false);
  assert.equal(await auth.verifyPassword('x', 'garbage'), false);
});

test('session tokens: valid, forged, expired, revoked', () => {
  const user = { u: 'elijah', role: 'owner', sv: 1 };
  const t = auth.makeSessionToken(user);
  assert.deepEqual(auth.readSessionToken(t), { u: 'elijah', role: 'owner' });
  const [p, s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'elijah', role: 'owner', sv: 1, exp: Date.now() + 1e12 })).toString('base64url');
  assert.equal(auth.readSessionToken(`${forged}.${s}`), null, 'payload swapped under an old signature');
  assert.equal(auth.readSessionToken(`${p}.${s.slice(0, -2)}xx`), null, 'tampered signature');
  assert.equal(auth.readSessionToken(auth.makeSessionToken(user, Date.now() - 31 * 864e5)), null, 'expired');
  assert.equal(auth.readSessionToken(auth.makeSessionToken({ ...user, sv: 2 })), null, 'session version bumped');
  assert.equal(auth.readSessionToken(auth.makeSessionToken({ ...user, u: 'ghost' })), null, 'unknown user');
});

// ─── login + gate ────────────────────────────────────────────────────────────

test('login sets a host-only HttpOnly Secure SameSite=Strict cookie', async () => {
  reset();
  const { r, cookie } = await login();
  assert.equal(r.code, 200);
  const set = r.headers['Set-Cookie'];
  assert.match(set, /^pl_session=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=2592000$/);
  assert.doesNotMatch(set, /Domain=/i);
  assert.ok(cookie.startsWith('pl_session='));
});

test('wrong password / unknown user → 401 after a delay, no cookie', async () => {
  reset();
  const t0 = Date.now();
  const bad = await login('elijah', 'nope');
  assert.equal(bad.r.code, 401);
  assert.ok(Date.now() - t0 >= 750, 'failure is slowed down');
  assert.equal(bad.r.headers['Set-Cookie'], undefined);
  assert.equal((await login('nobody', PW)).r.code, 401);
});

test('login without the X-PL header is refused', async () => {
  reset();
  const r = await admin({ method: 'POST', body: { action: 'login', u: 'elijah', password: PW } });
  assert.equal(r.code, 403);
});

test('pages: /dashboard redirects to /login without a session, serves the app with one', async () => {
  reset();
  const anon = await admin({ query: { view: 'app' } });
  assert.equal(anon.code, 302);
  assert.equal(anon.headers.Location, '/login');
  assert.equal(anon.body, '', 'no page content leaks with the redirect');
  assert.equal(anon.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');

  const { cookie } = await login();
  const ok = await admin({ query: { view: 'app' }, headers: { cookie } });
  assert.equal(ok.code, 200);
  assert.match(ok.body, /id="pl-app"/);
  assert.match(ok.body, /\/sync-layer\.js/);
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal(ok.headers['X-Frame-Options'], 'DENY');

  const keyOnly = await admin({ query: { view: 'app', key: 'k' } });
  assert.equal(keyOnly.code, 302, 'the admin key never opens the hosted page');

  const loginWhileIn = await admin({ query: { view: 'login' }, headers: { cookie } });
  assert.equal(loginWhileIn.code, 302);
  assert.equal(loginWhileIn.headers.Location, '/dashboard');
});

test('the served app no longer carries the hard-coded customer book', async () => {
  reset();
  const { cookie } = await login();
  const ok = await admin({ query: { view: 'app' }, headers: { cookie } });
  assert.doesNotMatch(ok.body, /function seed\(/);
  assert.doesNotMatch(ok.body, /@gmail\.com|@bristol\.ac\.uk|@outlook\.com/);
});

test('API: no session → 401; bad key → 403; legacy key still works until switched off', async () => {
  reset();
  assert.equal((await admin({ query: { action: 'state' } })).code, 401);
  assert.equal((await admin({ query: { action: 'state', key: 'wrong' } })).code, 403);
  assert.equal((await admin({ query: { action: 'state', key: 'k' } })).code, 200);
  process.env.ADMIN_KEY_LEGACY = '0';
  assert.equal((await admin({ query: { action: 'state', key: 'k' } })).code, 403);
  assert.equal((await call(analyticsHandler, { query: { scope: 'treasury', key: 'k' } })).code, 403);
  delete process.env.ADMIN_KEY_LEGACY;
});

test('API: cookie writes need X-PL; forged cookie is anonymous', async () => {
  reset();
  const { cookie } = await login();
  const noHeader = await admin({ method: 'POST', body: { action: 'state-save', section: 'orders', baseVersion: 0, data: [] }, headers: { cookie } });
  assert.equal(noHeader.code, 403);
  const forged = await admin({ query: { action: 'state' }, headers: { cookie: 'pl_session=abc.def' } });
  assert.equal(forged.code, 401);
  const who = await admin({ query: { action: 'whoami' }, headers: { cookie } });
  assert.deepEqual(who.body, { ok: true, user: { u: 'elijah', role: 'owner' }, via: 'session' });
});

test('logout clears the cookie', async () => {
  reset();
  const r = await admin({ method: 'POST', body: { action: 'logout' }, headers: { 'x-pl': '1' } });
  assert.equal(r.code, 200);
  assert.match(r.headers['Set-Cookie'], /^pl_session=; .*Max-Age=0$/);
});

// ─── state store ─────────────────────────────────────────────────────────────

test('state: empty store → every section null; save + read back', async () => {
  reset();
  const { cookie } = await login();
  const h = { cookie, 'x-pl': '1' };
  const empty = await admin({ query: { action: 'state' }, headers: h });
  assert.equal(empty.code, 200);
  assert.deepEqual(Object.keys(empty.body.sections).sort(), [...store.SECTIONS].sort());
  assert.ok(Object.values(empty.body.sections).every((v) => v === null));

  const orders = [{ id: 'a', club: 'Test CC', updated: '2026-11-25' }];
  const s1 = await admin({ method: 'POST', body: { action: 'state-save', section: 'orders', baseVersion: 0, data: orders }, headers: h });
  assert.equal(s1.code, 200);
  assert.equal(s1.body.version, 1);
  assert.equal(s1.body.count, 1);

  const back = await admin({ query: { action: 'state' }, headers: h });
  assert.deepEqual(back.body.sections.orders.data, orders);
  assert.equal(back.body.sections.orders.version, 1);
  assert.equal(back.body.sections.orders.updatedBy, 'elijah');
});

test('state: stale baseVersion → 409 with the current copy, nothing overwritten', async () => {
  reset();
  const { cookie } = await login();
  const h = { cookie, 'x-pl': '1' };
  await admin({ method: 'POST', body: { action: 'state-save', section: 'planner', baseVersion: 0, data: { general: { lanes: ['A'] } } }, headers: h });
  await admin({ method: 'POST', body: { action: 'state-save', section: 'planner', baseVersion: 1, data: { general: { lanes: ['A', 'B'] } } }, headers: h });
  const stale = await admin({ method: 'POST', body: { action: 'state-save', section: 'planner', baseVersion: 1, data: { general: { lanes: ['X'] } } }, headers: h });
  assert.equal(stale.code, 409);
  assert.equal(stale.body.conflict, true);
  assert.equal(stale.body.current.version, 2);
  assert.deepEqual(stale.body.current.data, { general: { lanes: ['A', 'B'] } });
  const first = await admin({ method: 'POST', body: { action: 'state-save', section: 'clubshops', baseVersion: 3, data: {} }, headers: h });
  assert.equal(first.code, 409, 'a new section must start from version 0');
});

test('state: a write carrying a stale ETag is refused by the store (ifMatch)', async () => {
  reset();
  await store.saveSection('orders', { baseVersion: 0, data: [{ id: 'a' }], user: 't' });
  const mock = await import('./mock-blob.mjs');
  const path = 'dashboard/state/orders.json';
  const seen = await store.readSection('orders');                         // we read…
  await mock.put(path, JSON.stringify({ version: 2, data: [{ id: 'b' }] }), { allowOverwrite: true });   // …another device writes…
  await assert.rejects(mock.put(path, 'x', { allowOverwrite: true, ifMatch: seen.etag }), /Precondition/);   // …our write is refused
  assert.deepEqual((await store.readSection('orders')).data, [{ id: 'b' }]);
});

test('state: unknown section, oversized section, store not configured', async () => {
  reset();
  const { cookie } = await login();
  const h = { cookie, 'x-pl': '1' };
  assert.equal((await admin({ method: 'POST', body: { action: 'state-save', section: 'secrets', baseVersion: 0, data: {} }, headers: h })).code, 400);
  const big = await admin({ method: 'POST', body: { action: 'state-save', section: 'orders', baseVersion: 0, data: ['x'.repeat(4 * 1024 * 1024)] }, headers: h });
  assert.equal(big.code, 413);
  const tok = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal((await admin({ query: { action: 'state' }, headers: h })).code, 503);
  process.env.BLOB_READ_WRITE_TOKEN = tok;
});

test('backups: nightly copy per section, 30 days kept', async () => {
  reset();
  await store.saveSection('orders', { baseVersion: 0, data: [{ id: 'a' }], user: 't' });
  await store.saveSection('planner', { baseVersion: 0, data: { general: {} }, user: 't' });
  // An old backup that should be pruned and a recent one that should stay.
  globalThis.__blob.set('dashboard/backups/2026-09-01/orders.json', '{}');
  globalThis.__blob.set('dashboard/backups/2026-11-20/orders.json', '{}');
  const r = await store.backupAll(new Date('2026-11-25T20:00:00Z'));
  assert.equal(r.day, '2026-11-25');
  assert.deepEqual(r.saved.sort(), ['orders', 'planner']);
  assert.equal(r.pruned, 1);
  assert.ok(globalThis.__blob.has('dashboard/backups/2026-11-25/orders.json'));
  assert.ok(globalThis.__blob.has('dashboard/backups/2026-11-20/orders.json'));
  assert.ok(!globalThis.__blob.has('dashboard/backups/2026-09-01/orders.json'));
});
