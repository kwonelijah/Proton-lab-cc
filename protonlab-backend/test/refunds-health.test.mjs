// test/refunds-health.test.mjs — refunds in the order feed, "Received back"
// (mark-returned), the Evri export skipping refunded orders, and the Blob
// usage reminders / morning status line (2026-11-27). Offline mocks only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
process.env.SESSION_SECRET = 'z'.repeat(48);
process.env.CRON_SECRET = 'cron';
delete process.env.GITHUB_TOKEN;   // stock commits fail fast → reported, never thrown

const { default: adminHandler, buildFeed, refundInfo } = await import('../api/admin.js');
const { default: evriHandler } = await import('../api/export-evri.js');
const { digestMessage, statusLine } = await import('../api/stock-sync.js');
const store = await import('../lib/dashboard-store.js');

function reset() {
  globalThis.__blob = new Map(); globalThis.__blobEtag = new Map(); globalThis.__blobAt = new Map();
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, updates: [] };
}
function mkRes() {
  return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
}
const call = async (h, req) => { const res = mkRes(); await h({ headers: { host: 'x' }, query: {}, ...req }, res); return res; };
const now = Math.floor(Date.now() / 1000);
const pi = (id, extra = {}) => ({ id, status: 'succeeded', amount: 4500, amount_received: 4500, currency: 'gbp', created: now - 3600,
  metadata: { items: JSON.stringify([['sunset-jersey', 'M', 1]]), customer_email: 'a@example.com', customer_phone: '1', ...extra.metadata }, ...extra, });
const charge = (refunded, at) => ({ id: 'ch', amount_refunded: refunded, refunds: { data: at ? [{ created: at }] : [] } });

test('refundInfo: none / partial / full, with the latest refund date and the returned stamp', () => {
  assert.equal(refundInfo(pi('pi_a')).refunded, null);
  assert.deepEqual(refundInfo(pi('pi_b', { latest_charge: charge(1000, now) })).refunded, 'partial');
  const full = refundInfo(pi('pi_c', { latest_charge: charge(4500, 1764000000), metadata: { returned_at: '2026-11-20T00:00:00Z' } }));
  assert.equal(full.refunded, 'full');
  assert.equal(full.refundedAmount, '45.00');
  assert.equal(full.refundedAt, new Date(1764000000 * 1000).toISOString());
  assert.equal(full.returnedAt, '2026-11-20T00:00:00Z');
});

test('feed: full refunds leave awaiting/dispatched for refunded[]; partial refunds stay with a tag', async () => {
  reset();
  globalThis.__stripe.pis.push(
    pi('pi_ok'),
    pi('pi_part', { latest_charge: charge(1000, now) }),
    pi('pi_full', { latest_charge: charge(4500, now) }),
    pi('pi_fulldisp', { latest_charge: charge(4500, now), metadata: { dispatched_at: '2026-11-01T00:00:00Z' } }),
  );
  const f = await buildFeed(30, { lookupContacts: false });
  assert.deepEqual(f.awaiting.map((o) => o.id).sort(), ['pi_ok', 'pi_part']);
  assert.equal(f.awaiting.find((o) => o.id === 'pi_part').refunded, 'partial');
  assert.deepEqual(f.dispatched.map((o) => o.id), []);
  assert.deepEqual(f.refunded.map((o) => o.id).sort(), ['pi_full', 'pi_fulldisp']);
});

test('mark-returned: stamps returned_at once, reports the stock movements, refuses a second time', async () => {
  reset();
  globalThis.__stripe.pis.push(pi('pi_full', { latest_charge: charge(4500, now) }));
  const first = await call(adminHandler, { method: 'POST', query: { key: 'k' }, body: { action: 'mark-returned', pi: 'pi_full' } });
  assert.equal(first.code, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.movements, [{ handle: 'sunset-jersey', size: 'M', qty: 1 }]);
  assert.ok(first.body.stock && first.body.stock.error, 'no GitHub token in tests → the stock error is reported, not thrown');
  const upd = globalThis.__stripe.updates.find((u) => u.id === 'pi_full');
  assert.ok(upd && upd.params.metadata.returned_at);
  globalThis.__stripe.pis[0].metadata.returned_at = upd.params.metadata.returned_at;   // the mock doesn't persist updates
  const again = await call(adminHandler, { method: 'POST', query: { key: 'k' }, body: { action: 'mark-returned', pi: 'pi_full' } });
  assert.equal(again.code, 409);
  const bad = await call(adminHandler, { method: 'POST', query: { key: 'k' }, body: { action: 'mark-returned', pi: 'nope' } });
  assert.equal(bad.code, 400);
});

test('Evri export: fully refunded orders are never posted', async () => {
  reset();
  globalThis.__stripe.pis.push(pi('pi_post'), pi('pi_refunded', { latest_charge: charge(4500, now) }));
  const r = await call(evriHandler, { method: 'GET', query: { key: 'k' } });
  const csv = String(r.body || '');
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 2, csv);   // header + the one postable order
});

test('usage level + morning status line', () => {
  const L = store.LIMITS;
  assert.equal(store.usageLevel({ reads: 0, writes: 0, lists: 0 }).level, 0);
  assert.equal(store.usageLevel({ reads: 0, writes: L.writes * 0.6, lists: L.writes * 0.15 }).level, 70);
  assert.equal(store.usageLevel({ reads: L.reads * 0.95, writes: 0, lists: 0 }).level, 90);
  const lv = store.usageLevel({ reads: 0, writes: 680, lists: 0 });
  assert.equal(statusLine({ backupOk: true, stockSyncOk: false }, lv), `Backup ✓ · stock sync ✗ · storage ${lv.pct}%`);
  const d = digestMessage({ summary: '1 overdue', sections: [{ items: [{ title: 'A', sub: 'a' }, { title: 'B', sub: 'b' }] }, { items: [{ title: 'C', sub: 'c' }] }] }, 'Backup ✓');
  assert.deepEqual(d.body.split('\n'), ['A — a', 'B — b', 'Backup ✓']);
});

test('markAlerted: true once per key', async () => {
  reset();
  await store.saveSections([{ section: 'orders', baseVersion: 0, data: [] }], { user: 't' });
  assert.equal(await store.markAlerted('usage-70:2026-11'), true);
  assert.equal(await store.markAlerted('usage-70:2026-11'), false);
});
