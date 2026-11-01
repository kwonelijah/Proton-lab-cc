import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

process.env.SITE_URL = 'https://protonlab.cc';
const { default: handler } = await import('../api/create-checkout-session.js');
const { decodeItems } = await import('../lib/order-items.js');

async function call(body) {
  globalThis.__stripe = { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: {}, updates: [], created: [] };
  const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'test' } }, res);
  return { res, params: globalThis.__stripe.created[0] };
}

test('retail checkout stamps channel / sku / utm metadata on the PaymentIntent and the Session', async () => {
  const { res, params } = await call({
    items: [{ handle: 'red-sky-jersey', size: 'M', quantity: 1, clubHandle: 'protonlab' }, { handle: 'white-cotton-socks', size: 'L', quantity: 2, clubHandle: 'protonlab' }],
    shippingRegion: 'uk', delivery: 'post',
    attribution: { utm_source: ' Facebook ', utm_medium: 'Paid-Social', utm_campaign: 'oct-launch', referrer: 'l.instagram.com', landing: '/shop', capturedAt: '2026-11-01T00:00:00Z' },
  });
  assert.equal(res.code, 200, JSON.stringify(res.body)); assert.ok(res.body.url);
  const m = params.payment_intent_data.metadata;
  assert.equal(m.channel, 'retail'); assert.equal(m.club_id, ''); assert.equal(m.club, 'Proton Lab' === m.club ? m.club : m.club);
  assert.equal(m.sku, 'red-sky-jersey/M');
  assert.equal(m.utm_source, 'facebook'); assert.equal(m.utm_medium, 'paid-social'); assert.equal(m.utm_campaign, 'oct-launch'); assert.equal(m.referrer, 'l.instagram.com');
  assert.equal(m.attributed, '1');
  assert.deepEqual(decodeItems(m).map((l) => [l.handle, l.size, l.qty]), [['red-sky-jersey', 'M', 1], ['white-cotton-socks', 'L', 2]], 'items tuples untouched');
  assert.equal(params.metadata.channel, 'retail'); assert.equal(params.metadata.utm_source, 'facebook'); assert.equal(params.metadata.club_id, '');
  assert.equal(params.mode, 'payment'); assert.equal(params.allow_promotion_codes, true, 'checkout behaviour unchanged');
});

test('club checkout: channel club + club_id; no attribution object → attributed empty (Unattributed)', async () => {
  const { res, params } = await call({
    items: [{ handle: 'ss-race-jersey', size: "Men's M", quantity: 1, clubHandle: 'ucl-cycling', clubName: 'UCL Cycling' }],
    shippingRegion: 'uk', delivery: 'post',
  });
  assert.equal(res.code, 200, JSON.stringify(res.body));
  const m = params.payment_intent_data.metadata;
  assert.equal(m.channel, 'club'); assert.equal(m.club_id, 'ucl-cycling'); assert.equal(m.club_handle, 'ucl-cycling'); assert.equal(m.club, 'UCL Cycling');
  assert.equal(m.sku, "ss-race-jersey/Men's M");
  assert.equal(m.utm_source, ''); assert.equal(m.attributed, '');
  assert.equal(params.metadata.channel, 'club'); assert.equal(params.metadata.club_id, 'ucl-cycling');
  assert.equal(Object.keys(m).length <= 30, true, `PI metadata keys: ${Object.keys(m).length} (Stripe caps objects at 50)`);
});
