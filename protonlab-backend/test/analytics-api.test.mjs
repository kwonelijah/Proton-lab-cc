import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
const { default: handler, _internal } = await import('../api/analytics.js');
const { encodeItems, loadProductMap } = await import('../lib/order-items.js');
const map = loadProductMap();
const pid = (h) => map[h].productId;

const T0 = 1761900000;   // 2026-10-31
function reset() {
  _internal.clearCache();
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, searchFails: false, updates: [] };
}
const charge = (over = {}) => ({ id: 'ch_x', created: T0 + 100, amount_refunded: 0, payment_method_details: { card: { brand: 'visa' } }, balance_transaction: { amount: 10199, fee: 173, net: 10026, exchange_rate: null, available_on: T0 + 7 * 86400, currency: 'gbp' }, ...over });
function pi(id, over = {}) {
  return { id, status: 'succeeded', created: T0, amount: 10199, currency: 'gbp', receipt_email: null,
    metadata: { club: 'Proton Lab', ...encodeItems([{ handle: 'red-sky-jersey', size: 'L', quantity: 1 }, { handle: 'white-cotton-socks', size: 'M', quantity: 1 }]), subtotal: '9700', shipping_amount: '499', discount_amount: '0', customer_email: 'A@X.com', customer_name: 'Ann', shipping_method: 'standard', delivery: 'post', utm_source: 'Facebook', attributed: '1' },
    latest_charge: charge(), shipping: { name: 'Ann', phone: '', address: { line1: '1 St', postal_code: 'EH1 2AB', country: 'GB' } }, ...over };
}
function session(id, piId, lines, over = {}) {
  return { id, created: T0 - 10, status: 'complete', payment_intent: piId, customer_details: { email: 'a@x.com', phone: '+447000000000', name: 'Ann', address: { country: 'GB' } },
    amount_subtotal: 9700, total_details: { amount_discount: 0 }, shipping_cost: { amount_total: 499 }, line_items: { has_more: false, data: lines }, ...over };
}
const li = (handle, qty, amountTotal, priceId = 'price_archived') => ({ quantity: qty, amount_total: amountTotal, amount_subtotal: amountTotal, price: { id: priceId, product: pid(handle) } });
async function call(query, method = 'GET') {
  const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method, query: { key: 'k', ...query } }, res);
  return res;
}

test('auth, method and window validation', async () => {
  reset();
  assert.equal((await call({ key: 'wrong' })).code, 403);
  assert.equal((await call({}, 'POST')).code, 405);
  let r = await call({ scope: 'orders' }); assert.equal(r.code, 400); assert.match(r.body.error, /since/);
  r = await call({ scope: 'orders', since: String(T0), until: String(T0 + 100 * 86400) }); assert.equal(r.code, 400); assert.match(r.body.error, /93 days/);
  r = await call({ scope: 'nope', since: '1' }); assert.equal(r.code, 400);
  assert.equal((await call({ scope: 'treasury' })).headers['Cache-Control'], 'no-store');
});

test('orders: exact line money from the session, sizes from the tuples, GBP from the balance transaction', async () => {
  reset();
  globalThis.__stripe.pis = [pi('pi_gbp'), { ...pi('pi_abandoned'), status: 'requires_payment_method' }];
  globalThis.__stripe.sessions = [session('cs_1', 'pi_gbp', [li('red-sky-jersey', 1, 8500), li('white-cotton-socks', 1, 1200)])];
  const r = await call({ scope: 'orders', since: String(T0 - 86400), until: String(T0 + 86400) });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.count, 1);
  const row = r.body.orders[0];
  assert.equal(row.id, 'pi_gbp'); assert.equal(row.channel, 'retail'); assert.equal(row.email, 'a@x.com'); assert.equal(row.postcodeArea, 'EH'); assert.equal(row.country, 'GB');
  assert.equal(row.grossGbp, 101.99); assert.equal(row.fee, 1.73); assert.equal(row.net, 100.26); assert.equal(row.fx, 1);
  assert.equal(row.shippingGbp, 4.99); assert.equal(row.discountGbp, 0); assert.equal(row.subtotalGbp, 97);
  assert.equal(row.paidAt, new Date((T0 + 100) * 1000).toISOString()); assert.equal(row.paymentMethod, 'visa'); assert.equal(row.sessionId, 'cs_1');
  assert.deepEqual(row.items.map((i) => [i.handle, i.size, i.qty, i.lineGbp, !!i.allocated]), [['red-sky-jersey', 'L', 1, 85, false], ['white-cotton-socks', 'M', 1, 12, false]]);
  assert.equal(row.items[0].productId, pid('red-sky-jersey'));
  assert.deepEqual(row.utm, { source: 'facebook', medium: '', campaign: '', referrer: '', attributed: true, fbc: false });
  assert.match(row.ref, /^Order #\d{5}$/);
  assert.equal(typeof r.body.serverTime, 'string');
  const again = await call({ scope: 'orders', since: String(T0 - 86400), until: String(T0 + 86400) });
  assert.equal(again.body.cached, true, 'second identical call is served from the warm cache');
});

test('orders: EUR order settles via the balance transaction fx', async () => {
  reset();
  const eur = pi('pi_eur', { amount: 11000, currency: 'eur', metadata: { club: 'Proton Lab', ...encodeItems([{ handle: 'ocean-blue-jersey', size: 'M', quantity: 1 }]), subtotal: '11000', shipping_amount: '0', discount_amount: '0', customer_email: 'b@x.com' },
    latest_charge: charge({ balance_transaction: { amount: 9570, fee: 290, net: 9280, exchange_rate: 0.87, available_on: T0, currency: 'gbp' } }), shipping: { name: 'B', address: { line1: 'x', postal_code: '10115', country: 'DE' } } });
  globalThis.__stripe.pis = [eur];
  globalThis.__stripe.sessions = [session('cs_e', 'pi_eur', [li('ocean-blue-jersey', 1, 11000)], { amount_subtotal: 11000, shipping_cost: null })];
  const row = (await call({ scope: 'orders', since: String(T0 - 1), until: String(T0 + 1) })).body.orders[0];
  assert.equal(row.currency, 'eur'); assert.equal(row.gross, 110); assert.equal(row.grossGbp, 95.7); assert.equal(row.fee, 2.9); assert.equal(row.net, 92.8); assert.equal(row.fx, 0.87);
  assert.equal(row.items[0].lineGbp, 95.7); assert.equal(row.country, 'DE'); assert.equal(row.postcodeArea, '');
});

test('orders: club order with no session → pro-rata allocation at the club price, refunds and discounts in GBP', async () => {
  reset();
  const club = pi('pi_club', { amount: 8099, metadata: { club: 'UCL Cycling', club_handle: 'ucl-cycling', ...encodeItems([{ handle: 'ss-race-jersey', size: "Men's M", quantity: 1 }]), subtotal: '8600', shipping_amount: '499', discount_amount: '1000', promo_code: 'TEN', delivery: 'club', shipping_method: 'club', shipping_region: 'uk' },
    latest_charge: charge({ amount_refunded: 8099, balance_transaction: { amount: 8099, fee: 130, net: 7969, exchange_rate: null, available_on: T0, currency: 'gbp' } }), shipping: null });
  globalThis.__stripe.pis = [club];
  const row = (await call({ scope: 'orders', since: String(T0 - 1), until: String(T0 + 1) })).body.orders[0];
  assert.equal(row.channel, 'club'); assert.equal(row.clubHandle, 'ucl-cycling'); assert.equal(row.country, 'GB'); assert.equal(row.refundedGbp, 80.99);
  assert.equal(row.discountGbp, 10); assert.equal(row.shippingGbp, 4.99); assert.equal(row.promoCode, 'TEN'); assert.equal(row.delivery, 'club');
  assert.deepEqual(row.items.map((i) => [i.handle, i.size, i.qty, i.lineGbp, i.allocated]), [['ss-race-jersey', "Men's M", 1, 76, true]]);
  assert.match(row.ref, /^UCL Cycling #/);
  assert.equal(row.utm.attributed, false);
});

test('orders: reordered tuples still match by handle; a quantity mismatch falls back to allocation', async () => {
  reset();
  const re = pi('pi_re', { amount: 18500, metadata: { club: 'Proton Lab', ...encodeItems([{ handle: 'black-bib-shorts', size: 'L', quantity: 1 }, { handle: 'red-sky-jersey', size: 'M', quantity: 1 }]), subtotal: '18500', shipping_amount: '0', discount_amount: '0' } });
  const mm = pi('pi_mm', { amount: 17000, metadata: { club: 'Proton Lab', ...encodeItems([{ handle: 'red-sky-jersey', size: 'L', quantity: 2 }]), subtotal: '17000', shipping_amount: '0', discount_amount: '0' } });
  globalThis.__stripe.pis = [re, mm];
  globalThis.__stripe.sessions = [
    session('cs_re', 'pi_re', [li('red-sky-jersey', 1, 8500), li('black-bib-shorts', 1, 10000)]),
    session('cs_mm', 'pi_mm', [li('red-sky-jersey', 1, 8500)]),
  ];
  const rows = (await call({ scope: 'orders', since: String(T0 - 1), until: String(T0 + 1) })).body.orders;
  const r1 = rows.find((r) => r.id === 'pi_re'), r2 = rows.find((r) => r.id === 'pi_mm');
  assert.deepEqual(r1.items.map((i) => [i.handle, i.size, i.lineGbp]), [['red-sky-jersey', 'M', 85], ['black-bib-shorts', 'L', 100]]);
  assert.equal(r2.items[0].allocated, true); assert.equal(r2.items[0].qty, 2); assert.equal(r2.items[0].lineGbp, 170);
});

test('orders: search failure falls back to list + status filter; lite returns mutable fields only', async () => {
  reset();
  globalThis.__stripe.searchFails = true;
  globalThis.__stripe.pis = [pi('pi_gbp', { metadata: { ...pi('x').metadata, dispatched_at: '2026-11-01T10:00:00Z', tracking: 'H1' } }), { ...pi('pi_abandoned'), status: 'requires_payment_method' }];
  const r = await call({ scope: 'orders', since: String(T0 - 1), until: String(T0 + 1), lite: '1' });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.lite, true); assert.equal(r.body.count, 1);
  assert.deepEqual(Object.keys(r.body.orders[0]).sort(), ['deliveredAt', 'dispatchedAt', 'id', 'productionAt', 'refundedGbp', 'shipOverride', 'tracking'].sort());
  assert.equal(r.body.orders[0].tracking, 'H1');
});

test('changes: refunds and disputes carry settled GBP with the right signs', async () => {
  reset();
  globalThis.__stripe.refunds = [
    { id: 're_1', created: T0, payment_intent: 'pi_club', charge: 'ch_x', amount: 8099, currency: 'gbp', reason: 'requested_by_customer', status: 'succeeded', balance_transaction: { amount: -8099, fee: 0, net: -8099, currency: 'gbp' } },
    { id: 're_eur', created: T0, payment_intent: 'pi_eur', charge: 'ch_y', amount: 11000, currency: 'eur', reason: null, status: 'succeeded', balance_transaction: { amount: -9570, fee: 0, net: -9570, currency: 'gbp' } },
    { id: 're_f', created: T0, payment_intent: 'pi_x', charge: 'ch_z', amount: 500, currency: 'gbp', reason: null, status: 'failed', balance_transaction: null },
    { id: 're_old', created: T0 - 10 * 86400, payment_intent: 'pi_old', charge: 'ch_o', amount: 100, currency: 'gbp', status: 'succeeded', balance_transaction: null },
  ];
  globalThis.__stripe.disputes = [
    { id: 'dp_1', created: T0, payment_intent: 'pi_club', charge: 'ch_x', amount: 8099, currency: 'gbp', reason: 'fraudulent', status: 'lost', balance_transactions: [{ amount: -8099, fee: 1500, net: -9599 }], evidence_details: { due_by: T0 + 5 * 86400 } },
    { id: 'dp_w', created: T0, payment_intent: 'pi_gbp', charge: 'ch_w', amount: 10199, currency: 'gbp', reason: 'general', status: 'warning_needs_response', balance_transactions: [] },
  ];
  const r = await call({ scope: 'changes', since: String(T0 - 86400) });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.refunds.map((f) => [f.id, f.amountGbp, f.status]), [['re_1', 80.99, 'succeeded'], ['re_eur', 95.7, 'succeeded'], ['re_f', 5, 'failed']]);
  assert.equal(r.body.disputes[0].amountGbp, 80.99); assert.equal(r.body.disputes[0].netGbp, -95.99); assert.equal(r.body.disputes[0].status, 'lost');
  assert.equal(r.body.disputes[1].amountGbp, 101.99); assert.equal(r.body.disputes[1].netGbp, 0);
});

test('treasury: balance per currency and payouts by arrival date', async () => {
  reset();
  globalThis.__stripe.balance = { available: [{ amount: 41250, currency: 'gbp' }], pending: [{ amount: 12000, currency: 'gbp' }], livemode: true };
  globalThis.__stripe.payouts = [{ id: 'po_1', arrival_date: T0, created: T0 - 2 * 86400, amount: 30000, currency: 'gbp', status: 'paid', automatic: true }, { id: 'po_old', arrival_date: T0 - 500 * 86400, created: 0, amount: 1, currency: 'gbp', status: 'paid' }];
  const r = await call({ scope: 'treasury' });
  assert.deepEqual(r.body.balance.available, [{ currency: 'gbp', amount: 412.5 }]);
  assert.deepEqual(r.body.payouts.map((p) => [p.id, p.amount, p.status]), [['po_1', 300, 'paid']]);
});

test('funnel: not configured → setup hint, never cached', async () => {
  reset();
  delete process.env.GA4_PROPERTY_ID;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'svc@example.iam.gserviceaccount.com' });
  const r = await call({ scope: 'funnel', start: '2026-10-01', end: '2026-10-31' });
  assert.equal(r.code, 200); assert.equal(r.body.error, 'GA4_NOT_CONFIGURED'); assert.equal(r.body.serviceAccount, 'svc@example.iam.gserviceaccount.com');
  assert.equal(r.body.start, '2026-10-01'); assert.equal(r.body.days, null);
  assert.equal((await call({ scope: 'funnel', start: '2026-10-01', end: '2026-10-31' })).body.cached, undefined);
});
