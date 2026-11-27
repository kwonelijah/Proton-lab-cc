// test/mac-invoices.test.mjs — the Mac helpers' key (DASHBOARD_MAC_KEY), the
// invoice folder-watch upload (match → attached to the deal; no match → Today
// "Invoices to link" → invoice-link), patchOrder, backup download (2026-11-27).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
process.env.SESSION_SECRET = 'q'.repeat(48);
process.env.DASHBOARD_MAC_KEY = 'm'.repeat(40);

const auth = await import('../lib/auth.js');
const store = await import('../lib/dashboard-store.js');
const { default: adminHandler } = await import('../api/admin.js');
const PW = 'correct horse battery';
process.env.DASHBOARD_USERS = JSON.stringify([{ u: 'elijah', hash: await auth.hashPassword(PW), role: 'owner', sv: 1 }]);

function reset() {
  globalThis.__blob = new Map(); globalThis.__blobEtag = new Map(); globalThis.__blobAt = new Map();
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, updates: [] };
  auth._resetThrottle();
}
function mkRes() { return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } }; }
const call = async (req) => { const res = mkRes(); await adminHandler({ query: {}, ...req, headers: { host: 'x', ...(req.headers || {}) } }, res); return res; };
const MAC = { authorization: 'Bearer ' + 'm'.repeat(40) };
const PDF = Buffer.from('%PDF-1.4\n% test invoice\n');
const deals = [
  { id: 'd1', club: 'Synergy Performance', stage: 'order', docs: [] },
  { id: 'd2', club: 'University of Dundee CC', stage: 'discuss', docs: [] },
  { id: 'd3', club: 'Old Deal', stage: 'delivered', docs: [], deleted: true },
];
async function seed() { reset(); await store.saveSections([{ section: 'orders', baseVersion: 0, data: deals.map((d) => ({ ...d })) }], { user: 't' }); }
const upload = (info, body = PDF, headers = MAC) => call({ method: 'POST', query: { action: 'invoice-upload' }, headers: { ...headers, 'x-invoice': JSON.stringify(info) }, body });

test('Mac key: only backups + invoice upload; everything else 403; a wrong key is refused', async () => {
  await seed();
  assert.equal((await call({ method: 'GET', query: { action: 'state' }, headers: MAC })).code, 403);
  assert.equal((await call({ method: 'GET', query: { format: 'json' }, headers: MAC })).code, 403);
  assert.equal((await call({ method: 'POST', body: { action: 'state-save', changes: [] }, headers: MAC })).code, 403);
  assert.equal((await call({ method: 'GET', query: { action: 'backup', path: 'dashboard/backups/x.json' }, headers: MAC })).code, 403, 'backup summary needs download=1');
  assert.equal((await call({ method: 'GET', query: { action: 'backups' }, headers: MAC })).code, 200);
  assert.equal((await call({ method: 'GET', query: { action: 'backups' }, headers: { authorization: 'Bearer wrong' } })).code, 403);
});

test('backup download: the raw state text, Mac key + download=1', async () => {
  await seed();
  await store.backupAll();
  const list = (await call({ method: 'GET', query: { action: 'backups' }, headers: MAC })).body.backups;
  const r = await call({ method: 'GET', query: { action: 'backup', path: list[0].path, download: '1' }, headers: MAC });
  assert.equal(r.code, 200);
  assert.equal(JSON.parse(r.body).sections.orders.data.length, 3);
});

test('invoice upload: matched by client folder → attached, fields set; re-send is a no-op', async () => {
  await seed();
  const r = await upload({ no: '00035', total: 1700.75, date: '2026-11-27', client: 'Synergy Performance', billTo: 'Synergy Performance Ltd' });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.matched, r.body.order], [true, 'd1']);
  const d1 = (await store.readAll()).sections.orders.data.find((o) => o.id === 'd1');
  assert.deepEqual([d1.paidVia, d1.invoiceNo, d1.invoiceAmount, d1.invoiceSentDate, d1.invoicePaidDate], ['invoice', '00035', '1700.75', '2026-11-27', '']);
  assert.equal(d1.docs[0].label, 'Invoice 00035');
  assert.match(d1.docs[0].link, /^\/api\/admin\?action=doc&path=docs%2Fd1%2F/);
  const again = await upload({ no: '00035', total: 1700.75, client: 'Synergy Performance' });
  assert.equal(again.body.duplicate, true);
  assert.equal((await store.readAll()).sections.orders.data.find((o) => o.id === 'd1').docs.length, 1);
});

test('invoice upload: fuzzy club names ("Dundee" ~ "University of Dundee CC"); deleted deals ignored', async () => {
  await seed();
  assert.equal((await upload({ no: '00036', total: 90, client: 'University of Dundee CC' })).body.order, 'd2');
  assert.equal((await upload({ no: '00037', total: 90, client: 'Old Deal' })).body.matched, false);
});

test('unmatched → waits in usage.unmatchedInvoices → invoice-link attaches it and clears the list', async () => {
  await seed();
  const r = await upload({ no: '00038', total: 640, date: '2026-11-27', client: 'Hup CC' });
  assert.equal(r.body.matched, false);
  const login = await call({ method: 'POST', body: { action: 'login', u: 'elijah', password: PW }, headers: { 'x-pl': '1' } });
  const S = { cookie: login.headers['Set-Cookie'].split(';')[0], 'x-pl': '1' };
  const u = await call({ method: 'GET', query: { action: 'usage' }, headers: S });
  assert.deepEqual(u.body.unmatchedInvoices.map((v) => [v.no, v.total, v.client]), [['00038', 640, 'Hup CC']]);
  const link = await call({ method: 'POST', body: { action: 'invoice-link', no: '00038', order: 'd2' }, headers: S });
  assert.equal(link.code, 200, JSON.stringify(link.body));
  const d2 = (await store.readAll()).sections.orders.data.find((o) => o.id === 'd2');
  assert.deepEqual([d2.invoiceNo, d2.invoiceAmount, d2.docs.length], ['00038', '640.00', 1]);
  assert.equal((await call({ method: 'GET', query: { action: 'usage' }, headers: S })).body.unmatchedInvoices.length, 0);
});

test('invoice upload rejects non-PDF bodies and bad numbers', async () => {
  await seed();
  assert.equal((await upload({ no: '00039', client: 'Synergy Performance' }, Buffer.from('hello'))).code, 400);
  assert.equal((await upload({ no: 'abc', client: 'Synergy Performance' })).code, 400);
});

test('patchOrder: bumps the section version so open dashboards merge on next save', async () => {
  await seed();
  const before = (await store.readAll()).sections.orders.version;
  await store.patchOrder('d1', (o) => { o.notes = 'x'; });
  assert.equal((await store.readAll()).sections.orders.version, before + 1);
  assert.equal((await store.patchOrder('nope', () => {})).status, 404);
});
