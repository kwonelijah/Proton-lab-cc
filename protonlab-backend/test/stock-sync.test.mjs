import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
const { default: handler } = await import('../api/stock-sync.js');
const { encodeItems } = await import('../lib/order-items.js');

const now = Math.floor(Date.now() / 1000);
const pi = (id, meta) => ({ id, status: 'succeeded', created: now - 3600, amount: 1, currency: 'gbp', metadata: meta });
async function call(query) {
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: 'GET', query: { key: 'k', ...query }, headers: {} }, res);
  return res;
}

test('nightly stock sync skips club-shop payments (made-to-order kit) and counts them', async () => {
  globalThis.__stripe = { pis: [
    pi('pi_retail', { club: 'Proton Lab', ...encodeItems([{ handle: 'red-sky-jersey', size: 'L', quantity: 1 }]) }),
    pi('pi_club_handle', { club: 'UCL Cycling', club_handle: 'ucl-cycling', ...encodeItems([{ handle: 'white-cotton-socks', size: 'M', quantity: 1 }]) }),
    pi('pi_club_named', { club: 'Bath CC', ...encodeItems([{ handle: 'white-cotton-socks', size: 'M', quantity: 2 }]) }),
    pi('pi_channel', { channel: 'club', club: 'Proton Lab', ...encodeItems([{ handle: 'aero-socks', size: 'M', quantity: 1 }]) }),
    pi('pi_synced', { club: 'Proton Lab', stock_synced: 'x', ...encodeItems([{ handle: 'red-sky-jersey', size: 'M', quantity: 1 }]) }),
  ], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: {}, updates: [] };
  const r = await call({ dryRun: '1' });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.orders, 1);
  assert.equal(r.body.clubSkipped, 3);
  assert.deepEqual(r.body.movements, [{ handle: 'red-sky-jersey', size: 'L', qty: -1 }]);
  assert.equal(globalThis.__stripe.updates.length, 0, 'a dry run never stamps anything');
});

test('nothing to sync still reports (and would stamp) the skipped club payments', async () => {
  globalThis.__stripe.pis = [pi('pi_club_only', { club: 'Bath CC', ...encodeItems([{ handle: 'white-cotton-socks', size: 'M', quantity: 2 }]) })];
  const dry = await call({ dryRun: '1' });
  assert.equal(dry.body.orders, 0); assert.equal(dry.body.clubSkipped, 1);
  const wet = await call({});
  assert.equal(wet.body.message, 'nothing to sync'); assert.equal(wet.body.clubStamped, 1);
  assert.equal(globalThis.__stripe.updates[0].id, 'pi_club_only');
  assert.match(globalThis.__stripe.updates[0].params.metadata.stock_synced, /^skipped-club:\d{4}-\d{2}-\d{2}$/);
});
