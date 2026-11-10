// test/bank-transfer.test.mjs — bank-transfer club shops end to end, offline:
// api/bank-transfer-order.js → lib/bank-orders.js (mock Blob store) →
// api/admin.js feed / mark-paid / dispatch / status / update-order /
// cancel-order → api/analytics.js rows. No network: Stripe and Blob are the
// test mocks, and with no Resend key every email returns {ok:false}, which
// the handlers tolerate by design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.proton_export_key = 'k';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
process.env.BANK_ACCOUNT_NAME = 'Test Account';
process.env.BANK_SORT_CODE = '00-00-00';
process.env.BANK_ACCOUNT_NUMBER = '00000000';

const { default: orderHandler } = await import('../api/bank-transfer-order.js');
const { default: adminHandler } = await import('../api/admin.js');
const { default: analyticsHandler, _internal } = await import('../api/analytics.js');
const { BANK_TRANSFER_CLUBS } = await import('../config/shipping.js');
const { BANK_DETAILS } = await import('../config/bank.js');
const bank = await import('../lib/bank-orders.js');
// The committed config/bank.js holds the real account; tests run against the
// BANK_* env values above, so blank the config for this process.
BANK_DETAILS.accountName = ''; BANK_DETAILS.sortCode = ''; BANK_DETAILS.accountNumber = ''; BANK_DETAILS.iban = ''; BANK_DETAILS.bic = '';

// Three test shops: posted delivery, central (club) delivery, collection option.
BANK_TRANSFER_CLUBS.add('edinburgh-university-cycling-club');
BANK_TRANSFER_CLUBS.add('university-of-bath-cycling-club');
BANK_TRANSFER_CLUBS.add('swansea-university-road-team');

function reset() {
  globalThis.__blob = new Map();
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, searchFails: false, updates: [] };
  _internal.clearCache();
}
function mkRes() {
  return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, end() { return this; } };
}
// A fresh IP per call unless a test wants to hit the per-IP rate limit.
let ipSeq = 0;
async function order(body, ip) {
  if (!ip) { ipSeq++; ip = `10.0.${ipSeq >> 8}.${ipSeq & 255}`; }
  const res = mkRes();
  await orderHandler({ method: 'POST', body, headers: { 'x-forwarded-for': ip, 'user-agent': 'test' } }, res);
  return res;
}
async function admin(method, { query = {}, body } = {}) {
  const res = mkRes();
  await adminHandler({ method, query: { key: 'k', ...query }, body }, res);
  return res;
}
async function analytics(query) {
  const res = mkRes();
  await analyticsHandler({ method: 'GET', query: { key: 'k', ...query } }, res);
  return res;
}
const customer = { name: 'Ann Example', email: 'ANN@example.com', phone: '+44 7000 000000' };
const address = { line1: '1 High Street', line2: '', city: 'Edinburgh', state: '', postal_code: 'EH1 2AB', country: 'GB' };
const eucc = (size = "Men's M", quantity = 1) => ({ handle: 'ss-race-jersey', size, quantity, clubHandle: 'edinburgh-university-cycling-club', clubName: 'Edinburgh University Cycling Club' });

test('posted order: server prices at the club price, charges the UK standard rate, stores the record, 7-day pay-by', async () => {
  reset();
  const r = await order({ items: [eucc("Men's M", 2), { ...eucc("Women's S") }], customer, delivery: 'post', address, attribution: { utm_source: 'Instagram', utm_medium: 'social' } });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.match(r.body.id, /^bt_\d{5}$/);
  assert.equal(r.body.payRef, `PL-${r.body.id.slice(3)}`);
  assert.equal(r.body.subtotal, '258.00', 'club price 86 × 3');
  assert.equal(r.body.shippingAmount, '0.00', 'free over £110');
  assert.equal(r.body.amount, '258.00');
  assert.equal(r.body.ref, `Edinburgh University Cycling Club #${r.body.id.slice(3)}`);
  assert.equal(r.body.bank.accountName, 'Test Account');
  assert.equal(r.body.emailed, false, 'no Resend key in tests');
  const rec = await bank.getBankOrder(r.body.id);
  assert.equal(rec.email, 'ann@example.com');
  assert.equal(rec.shippingMethod, 'standard'); assert.equal(rec.delivery, 'post'); assert.equal(rec.shippingRegion, 'uk');
  assert.deepEqual(rec.lines.map((l) => [l.handle, l.size, l.qty, l.unitAmount]), [['ss-race-jersey', "Men's M", 2, 8600], ['ss-race-jersey', "Women's S", 1, 8600]]);
  assert.equal(rec.paidAt, null);
  assert.equal(Math.round((Date.parse(rec.payBy) - Date.parse(rec.created)) / 86400000), 7);
  assert.equal(rec.attribution.utm_source, 'instagram'); assert.equal(rec.attribution.attributed, '1');
  assert.equal(rec.emails.received, 'failed', 'email outcome recorded on the record');
});

test('small posted order pays £2.99; Europe pays £5.99 international; unknown country refused', async () => {
  reset();
  let r = await order({ items: [{ handle: 'aero-socks', size: 'M', quantity: 1, clubHandle: 'edinburgh-university-cycling-club', clubName: 'EUCC' }], customer, delivery: 'post', address, dryRun: true });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.shippingAmount, '2.99'); assert.equal(r.body.shippingMethod, 'standard');
  assert.equal(globalThis.__blob.size, 0, 'dryRun stores nothing');
  r = await order({ items: [eucc()], customer, delivery: 'post', address: { ...address, country: 'DE' }, dryRun: true });
  assert.equal(r.body.shippingAmount, '5.99'); assert.equal(r.body.shippingMethod, 'international'); assert.equal(r.body.shippingRegion, 'europe');
  r = await order({ items: [eucc()], customer, delivery: 'post', address: { ...address, country: 'US' } });
  assert.equal(r.code, 400); assert.match(r.body.error, /UK, Ireland and Europe/);
});

test('delivery modes: central-delivery club needs no address; collection honoured only for a collection club', async () => {
  reset();
  const bath = { handle: 'ss-race-jersey', size: "Men's L", quantity: 1, clubHandle: 'university-of-bath-cycling-club', clubName: 'University of Bath Cycling Club' };
  let r = await order({ items: [bath], customer, delivery: 'post' });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.delivery, 'club'); assert.equal(r.body.shippingAmount, '0.00');
  const surt = { handle: 'ss-training-jersey', size: "Women's M", quantity: 1, clubHandle: 'swansea-university-road-team', clubName: 'Swansea University Road Team' };
  r = await order({ items: [surt], customer, delivery: 'collection' }, '2.2.2.2');
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.delivery, 'collection');
  r = await order({ items: [eucc()], customer, delivery: 'collection', address }, '3.3.3.3');
  assert.equal(r.code, 400); assert.match(r.body.error, /Collection from committee/);
});

test('refusals: mixed / non-bank basket, bad customer fields, honeypot, rate limit, unconfigured', async () => {
  reset();
  let r = await order({ items: [eucc(), { handle: 'red-sky-jersey', size: 'M', quantity: 1, clubHandle: 'protonlab' }], customer, delivery: 'post', address });
  assert.equal(r.code, 400); assert.match(r.body.error, /bank transfer is only available/);
  r = await order({ items: [{ handle: 'ss-race-jersey', size: 'M', quantity: 1, clubHandle: 'ucl-cycling', clubName: 'UCL Cycling' }], customer, delivery: 'post', address });
  assert.equal(r.code, 400, 'UCL is not a bank-transfer shop');
  r = await order({ items: [eucc()], customer: { ...customer, email: 'nope' }, delivery: 'post', address });
  assert.equal(r.code, 400); assert.match(r.body.error, /email/);
  r = await order({ items: [eucc()], customer: { ...customer, phone: '12' }, delivery: 'post', address });
  assert.equal(r.code, 400); assert.match(r.body.error, /phone/);
  r = await order({ items: [eucc()], customer, delivery: 'post', address: { ...address, postal_code: '' } });
  assert.equal(r.code, 400); assert.match(r.body.error, /postcode/);
  r = await order({ items: [eucc()], customer, delivery: 'post', address, website: 'http://spam' });
  assert.equal(r.code, 200); assert.equal(globalThis.__blob.size, 0, 'honeypot stores nothing');
  for (let i = 0; i < 5; i++) assert.equal((await order({ items: [eucc()], customer, delivery: 'post', address }, '9.9.9.9')).code, 200);
  r = await order({ items: [eucc()], customer, delivery: 'post', address }, '9.9.9.9');
  assert.equal(r.code, 429);
  const saved = process.env.BANK_ACCOUNT_NUMBER;
  delete process.env.BANK_ACCOUNT_NUMBER;
  r = await order({ items: [eucc()], customer, delivery: 'post', address }, '8.8.8.8');
  assert.equal(r.code, 503); assert.match(r.body.error, /isn't set up yet/);
  r = await order({ items: [eucc()], customer, delivery: 'post', address, dryRun: true }, '8.8.8.8');
  assert.equal(r.code, 200); assert.deepEqual(r.body.configured, { store: true, details: false });
  // config/bank.js is the primary source; env vars only override it
  BANK_DETAILS.accountNumber = '11111111';
  assert.deepEqual(bank.bankDetails(), { accountName: 'Test Account', sortCode: '00-00-00', accountNumber: '11111111' }, 'env name/sort code + config account number');
  BANK_DETAILS.accountNumber = '';
  process.env.BANK_ACCOUNT_NUMBER = saved;
});

test('admin feed: bank orders sit in awaiting with the Stripe entry shape + payment fields; cancelled ones hidden', async () => {
  reset();
  const placed = await order({ items: [eucc()], customer, delivery: 'post', address });
  const id = placed.body.id;
  let feed = await admin('GET', { query: { format: 'json' } });
  assert.equal(feed.code, 200);
  assert.ok(feed.body.capabilities.includes('bank-transfer'));
  assert.deepEqual(feed.body.bank, { store: 'ok', details: true });
  const e = feed.body.awaiting.find((o) => o.id === id);
  assert.ok(e, 'order in awaiting');
  assert.equal(e.payment, 'bank-transfer'); assert.equal(e.paid, false); assert.equal(e.payRef, `PL-${id.slice(3)}`);
  assert.equal(e.amount, '88.99', 'total incl. the £2.99 standard rate, as a Stripe amount would be'); assert.equal(e.shippingAmount, '2.99');
  assert.equal(e.service, 'standard'); assert.equal(e.place, 'Edinburgh, EH1 2AB'); assert.equal(e.clubHandle, 'edinburgh-university-cycling-club');
  assert.deepEqual(Object.keys(e).sort(), ['addr', 'address', 'amount', 'club', 'clubHandle', 'date', 'deliveredAt', 'discountAmount', 'dispatchedAt', 'email', 'id', 'items', 'lineItems', 'name', 'paid', 'paidAt', 'payBy', 'payRef', 'payment', 'phone', 'place', 'productionAt', 'promoCode', 'ref', 'service', 'shippingAmount', 'shippingName', 'symbol', 'tracking'].sort());
  // dispatch refused while unpaid
  let r = await admin('POST', { body: { pi: id, tracking: 'H123' } });
  assert.equal(r.code, 400); assert.match(r.body.error, /Payment not received/);
  // cancel → gone from the feed
  r = await admin('POST', { body: { action: 'cancel-order', id } });
  assert.equal(r.code, 200);
  feed = await admin('GET', { query: { format: 'json' } });
  assert.equal(feed.body.awaiting.length + feed.body.dispatched.length, 0);
  r = await admin('POST', { body: { action: 'mark-paid', id, paid: true } });
  assert.equal(r.code, 400, 'cancelled orders cannot be ticked');
});

test('tick paid → dispatch → status moves → update-order on a bank order; unconfigured store reported', async () => {
  reset();
  const id = (await order({ items: [eucc("Men's M", 1)], customer, delivery: 'post', address })).body.id;
  let r = await admin('POST', { body: { action: 'mark-paid', id, paid: true } });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.paid, true); assert.ok(r.body.paidAt);
  assert.equal(r.body.emailed, false, 'no Resend key — email failed, tick still recorded');
  let rec = await bank.getBankOrder(id);
  assert.ok(rec.paidAt); assert.equal(rec.paidEmailAt, null, 'failed email is not stamped, so a later tick retries it');
  r = await admin('POST', { body: { action: 'cancel-order', id } });
  assert.equal(r.code, 400, 'paid orders cannot be cancelled');
  // un-tick and re-tick
  r = await admin('POST', { body: { action: 'mark-paid', id, paid: false } });
  assert.equal(r.body.paid, false); assert.equal((await bank.getBankOrder(id)).paidAt, null);
  r = await admin('POST', { body: { action: 'mark-paid', id, paid: true } });
  assert.equal(r.body.paid, true);
  // dispatch: the email fails offline → 502 and nothing stamped (same as Stripe orders)
  r = await admin('POST', { body: { pi: id, tracking: 'H123', service: 'next-day' } });
  assert.equal(r.code, 502); assert.equal((await bank.getBankOrder(id)).dispatchedAt, null);
  // silent moves work without email
  r = await admin('POST', { body: { action: 'status', pi: id, status: 'dispatched' } });
  assert.equal(r.code, 200); rec = await bank.getBankOrder(id); assert.ok(rec.dispatchedAt); assert.equal(rec.deliveredAt, null);
  let feed = await admin('GET', { query: { format: 'json' } });
  assert.ok(feed.body.dispatched.some((o) => o.id === id && o.paid === true));
  r = await admin('POST', { body: { action: 'status', pi: id, status: 'processing' } });
  rec = await bank.getBankOrder(id); assert.equal(rec.dispatchedAt, null);
  // update-order: sizes re-priced at the club price, address replaced, amount untouched
  r = await admin('POST', { body: { action: 'update-order', pi: id, items: [{ handle: 'ss-race-jersey', size: "Men's L", qty: 2 }], shipping: { name: 'Ann Example', address: { line1: '2 New Road', city: 'Leith', postal_code: 'EH6 5AA', country: 'GB' } } } });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.place, 'Leith, EH6 5AA'); assert.equal(r.body.items, "SS Race Jersey (Men's L) ×2");
  rec = await bank.getBankOrder(id);
  assert.deepEqual(rec.lines.map((l) => [l.size, l.qty, l.unitAmount]), [["Men's L", 2, 8600]]);
  assert.equal(rec.amount, 8600 + 299, 'amount stays what the customer was asked to pay');
  assert.equal(rec.shipping.address.line1, '2 New Road'); assert.equal(rec.shipping.phone, '+44 7000 000000');
  // production email for the club includes the paid bank order (offline → counted as failed, not matched 0)
  r = await admin('POST', { body: { action: 'production', club: 'Edinburgh University Cycling Club' } });
  assert.equal(r.code, 200); assert.equal(r.body.matched, 1); assert.equal(r.body.failed, 1);
  // store unconfigured → feed still works, flagged
  delete process.env.BLOB_READ_WRITE_TOKEN;
  feed = await admin('GET', { query: { format: 'json' } });
  assert.equal(feed.body.bank.store, 'unconfigured'); assert.equal(feed.body.awaiting.length, 0);
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
});

test('analytics: a bank order becomes an invoice row only once paid, keyed by paidAt; lite voids an un-ticked one', async () => {
  reset();
  const id = (await order({ items: [eucc("Men's M", 1)], customer, delivery: 'post', address })).body.id;
  const now = Math.floor(Date.now() / 1000);
  const q = { scope: 'orders', since: String(now - 86400), until: String(now + 86400) };
  let r = await analytics(q);
  assert.equal(r.code, 200); assert.equal(r.body.orders.length, 0, 'unpaid → no row');
  _internal.clearCache();
  await admin('POST', { body: { action: 'mark-paid', id, paid: true } });
  r = await analytics(q);
  assert.equal(r.body.orders.length, 1);
  const row = r.body.orders[0];
  assert.equal(row.id, id); assert.equal(row.source, 'invoice'); assert.equal(row.channel, 'club'); assert.equal(row.clubHandle, 'edinburgh-university-cycling-club');
  assert.equal(row.grossGbp, 88.99); assert.equal(row.fee, 0); assert.equal(row.shippingGbp, 2.99); assert.equal(row.subtotalGbp, 86);
  assert.deepEqual(row.items, [{ handle: 'ss-race-jersey', name: 'SS Race Jersey', size: "Men's M", qty: 1, lineGbp: 86 }]);
  assert.equal(row.paymentMethod, 'Bank transfer (shop)'); assert.ok(row.paidAt); assert.equal(row.country, 'GB'); assert.equal(row.postcodeArea, 'EH');
  _internal.clearCache();
  r = await analytics({ ...q, lite: '1' });
  assert.deepEqual(r.body.orders.map((o) => [o.id, !!o.void]), [[id, false]]);
  _internal.clearCache();
  await admin('POST', { body: { action: 'mark-paid', id, paid: false } });
  r = await analytics({ ...q, lite: '1' });
  assert.deepEqual(r.body.orders.map((o) => [o.id, !!o.void]), [[id, true]], 'un-ticked → void on the lite scan');
  _internal.clearCache();
  r = await analytics(q);
  assert.equal(r.body.orders.length, 0);
});

test('bank-transfer emails render with the account details and reference; internal note says awaiting payment', async () => {
  const { render: received } = await import('../emails/bank-transfer-received.js');
  const { render: paid } = await import('../emails/bank-transfer-paid.js');
  const rec = { id: 'bt_12345', number: '12345', payRef: 'PL-12345', club: 'Test Club', clubHandle: 'test-club', name: 'Ann Example', email: 'ann@example.com', phone: '07000000000', delivery: 'post', shippingMethod: 'standard', shippingRegion: 'uk', shipping: { name: 'Ann Example', address: { line1: '1 High Street', city: 'Edinburgh', postal_code: 'EH1 2AB', country: 'GB' } }, lines: [{ handle: 'ss-race-jersey', name: 'SS Race Jersey', size: "Men's M", qty: 1, unitAmount: 8600 }], subtotal: 8600, shippingAmount: 299, amount: 8899, created: '2026-11-10T10:00:00.000Z', payBy: '2026-11-17T10:00:00.000Z', paidAt: null };
  const o = bank.emailOrder(rec);
  const e1 = received(o);
  assert.match(e1.subject, /Order received — Test Club — pay by bank transfer \(PL-12345\)/);
  for (const needle of ['PL-12345', '£88.99', 'Test Account', '00-00-00', '00000000', '17 November 2026', 'Test Club #12345', 'Standard Delivery — £2.99', 'UK bank transfer']) {
    assert.ok(e1.html.includes(needle), `html has ${needle}`); assert.ok(e1.text.includes(needle), `text has ${needle}`);
  }
  assert.ok(!e1.html.includes('IBAN'), 'no IBAN row unless configured');
  const e2 = paid(bank.emailOrder({ ...rec, paidAt: '2026-11-12T09:00:00.000Z' }));
  assert.equal(e2.subject, 'Payment received — Test Club — Test Club #12345');
  assert.ok(e2.html.includes('12 November 2026') && e2.text.includes('£88.99'));
  assert.equal(bank.feedEntry(rec).ref, 'Test Club #12345');
  assert.equal(bank.shippingLabelOf({ shippingMethod: 'international', shippingAmount: 0 }), 'Free European Delivery');
});
