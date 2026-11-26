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
  globalThis.__blobAt = new Map();
  globalThis.__blobOps = { put: 0, get: 0, list: 0, head: 0, del: 0 };
  globalThis.__blobNow = null;
  delete process.env.ADMIN_KEY_LEGACY;
  auth._resetThrottle();
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

// ─── state store (one blob) ──────────────────────────────────────────────────

const save = (h, changes, extra = {}) => admin({ method: 'POST', body: { action: 'state-save', changes, ...extra }, headers: h });
const state = (h) => admin({ query: { action: 'state' }, headers: h });
async function authed() { const { cookie } = await login(); return { cookie, 'x-pl': '1' }; }

test('state: empty → every section null; batched save is ONE blob write; read back', async () => {
  reset();
  const h = await authed();
  const empty = await state(h);
  assert.equal(empty.code, 200);
  assert.deepEqual(Object.keys(empty.body.sections).sort(), [...store.SECTIONS].sort());
  assert.ok(Object.values(empty.body.sections).every((v) => v === null));

  const orders = [{ id: 'a', club: 'Test CC', updated: '2026-11-25' }];
  globalThis.__blobOps.put = 0;
  const s1 = await save(h, [{ section: 'orders', baseVersion: 0, data: orders }, { section: 'planner', baseVersion: 0, data: { general: {} } }]);
  assert.equal(s1.code, 200);
  assert.deepEqual(s1.body.versions, { orders: 1, planner: 1 });
  assert.equal(globalThis.__blobOps.put, 1, 'two sections, one write');
  assert.deepEqual([...globalThis.__blob.keys()], ['dashboard/state.json']);

  globalThis.__blobOps.get = 0;
  const back = await state(h);
  assert.equal(globalThis.__blobOps.get, 1, 'a pull is one read');
  assert.deepEqual(back.body.sections.orders.data, orders);
  assert.equal(back.body.sections.orders.updatedBy, 'elijah');
});

test('state: v1 single-section body still accepted', async () => {
  reset();
  const h = await authed();
  const r = await admin({ method: 'POST', body: { action: 'state-save', section: 'orders', baseVersion: 0, data: [] }, headers: h });
  assert.equal(r.code, 200);
  assert.equal(r.body.versions.orders, 1);
});

test('state: stale baseVersion → 409 with current copies, nothing written', async () => {
  reset();
  const h = await authed();
  await save(h, [{ section: 'planner', baseVersion: 0, data: { a: 1 } }]);
  await save(h, [{ section: 'planner', baseVersion: 1, data: { a: 2 } }]);
  const before = globalThis.__blob.get('dashboard/state.json');
  const stale = await save(h, [{ section: 'planner', baseVersion: 1, data: { a: 9 } }, { section: 'orders', baseVersion: 0, data: [] }]);
  assert.equal(stale.code, 409);
  assert.deepEqual(stale.body.stale, ['planner']);
  assert.deepEqual(stale.body.current.planner.data, { a: 2 });
  assert.equal(stale.body.current.orders, null);
  assert.equal(globalThis.__blob.get('dashboard/state.json'), before, 'all-or-nothing');
});

test('state: a write race on DIFFERENT sections is retried server-side (no 409)', async () => {
  reset();
  await store.saveSections([{ section: 'orders', baseVersion: 0, data: [{ id: 'a' }] }], { user: 't' });
  // Another device writes planner between our read and our put: simulate by
  // making the first put fail its ETag check once.
  const mock = await import('./mock-blob.mjs');
  const path = 'dashboard/state.json';
  const doc = JSON.parse(globalThis.__blob.get(path));
  doc.sections.planner = { version: 1, data: { x: 1 } }; doc.rev++;
  const realEtag = globalThis.__blobEtag.get(path);
  let raced = false;
  const origGet = globalThis.__blobEtag.get.bind(globalThis.__blobEtag);
  globalThis.__blobEtag.get = (k) => {
    const v = origGet(k);
    if (k === path && !raced && v === realEtag) {
      raced = true;
      globalThis.__blob.set(path, JSON.stringify(doc));
      globalThis.__blobEtag.set(path, '"raced"');
      return realEtag;            // the reader still saw the old ETag
    }
    return v;
  };
  const r = await store.saveSections([{ section: 'orders', baseVersion: 1, data: [{ id: 'a' }, { id: 'b' }] }], { user: 't' });
  globalThis.__blobEtag.get = origGet;
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  const final = JSON.parse(globalThis.__blob.get(path));
  assert.deepEqual(final.sections.planner.data, { x: 1 }, 'the other device\'s section survived');
  assert.equal(final.sections.orders.data.length, 2);
  assert.ok(mock.put);
});

test('state: v1 per-section blobs migrate into state.json once', async () => {
  reset();
  globalThis.__blob.set('dashboard/state/orders.json', JSON.stringify({ version: 4, updatedAt: 'x', updatedBy: 'elijah', data: [{ id: 'old' }] }));
  globalThis.__blob.set('dashboard/state/planner.json', JSON.stringify({ version: 2, data: { p: 1 } }));
  const all = await store.readAll();
  assert.equal(all.sections.orders.version, 4);
  assert.deepEqual(all.sections.orders.data, [{ id: 'old' }]);
  assert.ok(globalThis.__blob.has('dashboard/state.json'));
  const r = await store.saveSections([{ section: 'orders', baseVersion: 4, data: [] }], { user: 't' });
  assert.equal(r.versions.orders, 5);
});

test('budget: unauthenticated requests make ZERO Blob calls', async () => {
  reset();
  globalThis.__blob.set('dashboard/state.json', JSON.stringify({ rev: 1, sections: {}, history: [], meta: {} }));
  globalThis.__blobOps = { put: 0, get: 0, list: 0, head: 0, del: 0 };
  await admin({ query: { view: 'app' } });
  await admin({ query: { view: 'login' } });
  await admin({ query: { action: 'state' } });
  await admin({ query: { action: 'backups' } });
  await admin({ method: 'POST', body: { action: 'state-save', changes: [] } });
  await admin({ method: 'POST', body: { action: 'snapshot' }, headers: { 'x-pl': '1' } });
  await admin({ method: 'POST', body: { action: 'login', u: 'elijah', password: 'wrong' }, headers: { 'x-pl': '1' } });
  assert.deepEqual(globalThis.__blobOps, { put: 0, get: 0, list: 0, head: 0, del: 0 });
});

test('state: unknown section, oversized state, store not configured', async () => {
  reset();
  const h = await authed();
  assert.equal((await save(h, [{ section: 'secrets', baseVersion: 0, data: {} }])).code, 400);
  const big = await save(h, [{ section: 'orders', baseVersion: 0, data: ['x'.repeat(4 * 1024 * 1024)] }]);
  assert.equal(big.code, 413);
  const tok = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal((await state(h)).code, 503);
  process.env.BLOB_READ_WRITE_TOKEN = tok;
});

test('history: entries stored with the save (user stamped, values capped), retrievable by id, log capped', async () => {
  reset();
  const h = await authed();
  await save(h, [{ section: 'orders', baseVersion: 0, data: [{ id: 'o1' }] }], {
    history: [{ t: '2026-11-26T10:00:00Z', u: 'spoofed', section: 'orders', id: 'o1', label: 'Test CC', changes: [{ f: 'stage', from: 'contact', to: 'x'.repeat(500) }] }],
  });
  const r = await admin({ query: { action: 'history', id: 'o1' }, headers: h });
  assert.equal(r.code, 200);
  assert.equal(r.body.entries.length, 1);
  assert.equal(r.body.entries[0].u, 'elijah', 'user comes from the session, not the client');
  assert.ok(r.body.entries[0].changes[0].to.length <= 120);
  const many = Array.from({ length: 300 }, (_, i) => ({ section: 'orders', id: 'o' + i, label: 'L', changes: [] }));
  for (let i = 0; i < 15; i++) await store.saveSections([{ section: 'planner', baseVersion: i, data: { i } }], { user: 't', history: many });
  const doc = JSON.parse(globalThis.__blob.get('dashboard/state.json'));
  assert.ok(doc.history.length <= store.HISTORY_MAX);
  assert.ok(JSON.stringify(doc.history).length <= store.HISTORY_MAX_BYTES);
});

test('usage: writes counted into the state blob; meter endpoint answers', async () => {
  reset();
  const h = await authed();
  await save(h, [{ section: 'orders', baseVersion: 0, data: [] }]);
  await save(h, [{ section: 'orders', baseVersion: 1, data: [{ id: 'a' }] }]);
  const u = await admin({ query: { action: 'usage' }, headers: h });
  assert.equal(u.code, 200);
  assert.ok(u.body.writes >= 2 && u.body.reads >= 2, JSON.stringify(u.body));
  assert.equal(u.body.limits.writes, 2000);
  assert.equal(u.body.estimate, true);
});

// ─── snapshots, backups, restore ─────────────────────────────────────────────

test('snapshot: only when changed, at most every 30 min; save+snapshot in one request', async () => {
  reset();
  const h = await authed();
  const r1 = await save(h, [{ section: 'orders', baseVersion: 0, data: [{ id: 'a' }] }], { snapshot: true });
  assert.equal(r1.body.snapshot.ok, true);
  const again = await admin({ method: 'POST', body: { action: 'snapshot' }, headers: h });
  assert.equal(again.body.skipped, 'unchanged');
  await save(h, [{ section: 'orders', baseVersion: 1, data: [] }]);
  const tooSoon = await admin({ method: 'POST', body: { action: 'snapshot' }, headers: h });
  assert.equal(tooSoon.body.skipped, 'recent');
  const later = await store.snapshot({ now: new Date(Date.now() + 31 * 60 * 1000) });
  assert.equal(later.ok, true);
});

test('backups: list, preview counts, restore one section (pre-restore snapshot taken)', async () => {
  reset();
  const h = await authed();
  await save(h, [{ section: 'orders', baseVersion: 0, data: [{ id: 'keep' }] }, { section: 'planner', baseVersion: 0, data: { p: 1 } }]);
  await store.backupAll(new Date('2026-11-25T20:00:00Z'));
  await save(h, [{ section: 'orders', baseVersion: 1, data: [] }, { section: 'planner', baseVersion: 1, data: { p: 2 } }]);

  const list = await admin({ query: { action: 'backups' }, headers: h });
  const nightly = list.body.backups.find((b) => b.kind === 'nightly');
  assert.ok(nightly && nightly.path === 'dashboard/backups/nightly/2026-11-25.json');
  const prev = await admin({ query: { action: 'backup', path: nightly.path }, headers: h });
  assert.equal(prev.body.counts.orders, 1);

  const bad = await admin({ method: 'POST', body: { action: 'restore', path: 'dashboard/state.json' }, headers: h });
  assert.equal(bad.code, 404, 'only backup paths can be restored from');

  const r = await admin({ method: 'POST', body: { action: 'restore', path: nightly.path, sections: ['orders'] }, headers: h });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.restored, ['orders']);
  assert.match(r.body.preRestore, /^dashboard\/backups\/restore\//);
  const now = await state(h);
  assert.deepEqual(now.body.sections.orders.data, [{ id: 'keep' }]);
  assert.deepEqual(now.body.sections.planner.data, { p: 2 }, 'unselected section untouched');
  assert.equal(now.body.sections.orders.version, 3, 'restore is a new version, so other devices pick it up');
});

test('backups: pruned to 30 nightly / 20 session / 10 restore', async () => {
  reset();
  await store.saveSections([{ section: 'orders', baseVersion: 0, data: [] }], { user: 't' });
  for (let i = 0; i < 35; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + i));
    globalThis.__blobNow = d.toISOString();
    globalThis.__blob.set(`dashboard/backups/nightly/${d.toISOString().slice(0, 10)}.json`, '{}');
    globalThis.__blobAt.set(`dashboard/backups/nightly/${d.toISOString().slice(0, 10)}.json`, d);
  }
  for (let i = 0; i < 25; i++) {
    const p = `dashboard/backups/session/s${String(i).padStart(2, '0')}.json`;
    globalThis.__blob.set(p, '{}'); globalThis.__blobAt.set(p, new Date(Date.UTC(2026, 10, 1, i)));
  }
  globalThis.__blobNow = null;
  const n = await store.pruneBackups();
  assert.equal(n, 5 + 5);
  const left = [...globalThis.__blob.keys()];
  assert.equal(left.filter((k) => k.includes('/nightly/')).length, 30);
  assert.equal(left.filter((k) => k.includes('/session/')).length, 20);
  assert.ok(!left.includes('dashboard/backups/nightly/2026-10-01.json'), 'oldest pruned');
});

// ─── security fixes ──────────────────────────────────────────────────────────

test('login throttle: 5 failures per IP → 429 with Retry-After; success clears; no Blob touched', async () => {
  reset();
  const ip = { 'x-pl': '1', 'x-forwarded-for': '203.0.113.9' };
  const tryLogin = (password, u = 'elijah') => admin({ method: 'POST', body: { action: 'login', u, password }, headers: ip });
  for (let i = 0; i < 5; i++) assert.equal((await tryLogin('nope' + i)).code, 401);
  const blocked = await tryLogin(PW);
  assert.equal(blocked.code, 429, 'even the right password waits out the window');
  assert.ok(+blocked.headers['Retry-After'] > 0);
  assert.equal(globalThis.__blobOps.get + globalThis.__blobOps.put, 0);
  // Another IP guessing the same username is throttled too (per-username key).
  const other = await admin({ method: 'POST', body: { action: 'login', u: 'elijah', password: PW }, headers: { 'x-pl': '1', 'x-forwarded-for': '198.51.100.1' } });
  assert.equal(other.code, 429);
  auth._resetThrottle();
  assert.equal((await tryLogin(PW)).code, 200);
});

test('session token with an expiry further out than a fresh session is rejected', () => {
  const t = auth.makeSessionToken({ u: 'elijah', role: 'owner', sv: 1 }, Date.now() + 365 * 864e5);
  assert.equal(auth.readSessionToken(t), null);
});
