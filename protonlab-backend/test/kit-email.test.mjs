import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../emails/kit-dispatched.js';

const order = { id: 'p1', ref: 'Hup CC #K1', amount: '0.00', currency: 'GBP', email: 'captain@example.com', name: 'Sam Jones', phone: 'N/A', club: 'Hup CC', product: 'SS Roadsuit ×5, SS Race Jersey (M) ×2', lineItems: [], shipping: { name: 'Sam Jones', address: { line1: '1 High Street', line2: null, city: 'Bath', state: null, postal_code: 'BA1 1AA', country: 'GB' } }, shippingMethod: 'standard', date: '2026-11-05T12:00:00.000Z' };

test('kit dispatch note: kit wording, no prices, tracking only when given', () => {
  const r = render(order, { trackingNumber: 'H00123456', trackingUrl: 'https://www.evri.com/track/parcel/H00123456' });
  assert.match(r.subject, /kit is on the way/i);
  assert.match(r.subject, /Hup CC/);
  assert.doesNotMatch(r.subject, /sample/i);
  assert.doesNotMatch(r.html, /sample/i);
  assert.doesNotMatch(r.text, /sample/i);
  assert.doesNotMatch(r.html, /0\.00|£/);   // no prices or order value anywhere
  assert.match(r.html, /The Hup CC kit has left us/);
  assert.match(r.html, /H00123456/);
  assert.match(r.html, /evri\.com\/track\/parcel\/H00123456/);
  assert.match(r.html, /1 High Street/);
  const plain = render({ ...order, club: '' }, {});
  assert.match(plain.html, /Your kit has left us/);
  assert.doesNotMatch(plain.html, /evri\.com\/track/);
  assert.equal(plain.subject, 'Your Proton Lab kit is on the way');
});
