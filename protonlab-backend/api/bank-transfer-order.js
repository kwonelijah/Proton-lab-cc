// api/bank-transfer-order.js
// Places a club-shop order paid by BANK TRANSFER (config/shipping.js
// BANK_TRANSFER_CLUBS) — the no-Stripe counterpart of create-checkout-session:
// the cart posts the basket plus the member's name / email / phone and, for
// posted delivery, an address; the server prices every line from
// data/stripe-products.json (club price override, same as checkout), charges
// delivery at the zone's standard GBP rate, stores the order in the Blob store
// (lib/bank-orders.js) and emails the member Proton Lab's account details with
// the order's unique payment reference. Nothing is paid here: the order waits
// on the dashboard until Elijah ticks "Payment received".
//
// Body: { items:[{handle,size,quantity,clubHandle,clubName}],
//         customer:{name,email,phone}, delivery:'post'|'collection',
//         address:{line1,line2,city,state,postal_code,country},
//         website (honeypot), dryRun?, fbp, fbc, gaClientId, gaSessionId, attribution }
// `dryRun:true` validates and prices without storing or emailing (the live
// smoke test) and reports whether the store and bank details are configured.

import {
  ZONES,
  EUROPE_COUNTRIES,
  isClubDelivery,
  isCollectionOption,
  isBankTransfer,
  COLLECTION_LABEL,
} from '../config/shipping.js';
import { sendOpsAlert } from '../lib/alerts.js';
import { loadProductMap, mergeLines, CHECKOUT_MAX_LINES } from '../lib/order-items.js';
import {
  createBankOrder,
  updateBankOrder,
  isStoreConfigured,
  bankDetails,
  emailOrder,
  minorToMoney,
  refOf,
  PAY_WITHIN_DAYS,
} from '../lib/bank-orders.js';
import { sendBankTransferReceived, sendInternalNotification } from '../lib/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ORIGIN = 'https://protonlab.cc';

// No payment gate protects this endpoint, so slow a script down: per warm
// instance, at most RATE_MAX orders per RATE_WINDOW_MS from one IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function regionForCountry(country) {
  if (country === 'GB') return 'uk';
  if (country === 'IE') return 'ireland';
  if (EUROPE_COUNTRIES.includes(country)) return 'europe';
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { items, customer, delivery, address, fbp, fbc, gaClientId, gaSessionId, attribution } = body;
  const dryRun = body.dryRun === true;

  // Honeypot filled → bot. Pretend success, record nothing.
  if (body.website) return res.status(200).json({ ok: true });

  const clientIp =
    (typeof req.headers?.['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0].trim()) || '';
  const clientUa = (req.headers?.['user-agent'] || '').slice(0, 480);
  if (!dryRun && clientIp && rateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many orders from this connection — please wait a few minutes and try again.' });
  }

  // ── Items: same validation and pricing as create-checkout-session ──────
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });
  let map;
  try {
    map = loadProductMap();
  } catch (err) {
    console.error('Failed to load product mapping:', err);
    return res.status(500).json({ error: 'Product catalog unavailable' });
  }
  const looked = [];
  for (const item of items) {
    if (!item || typeof item.handle !== 'string' || typeof item.size !== 'string') {
      return res.status(400).json({ error: 'Invalid cart item' });
    }
    const entry = map[item.handle];
    if (!entry || !entry.priceId) return res.status(400).json({ error: `Unknown product: ${item.handle}` });
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.min(999, Math.floor(item.quantity)) : 1;
    const clubHandle = typeof item.clubHandle === 'string' ? item.clubHandle : undefined;
    const override = entry.clubPrices && clubHandle ? entry.clubPrices[clubHandle] : undefined;
    looked.push({ item, entry, quantity, clubHandle, override });
  }
  // Club prices are GBP agreements, and the account the customer pays into is
  // a GBP account — bank-transfer orders are always priced in GBP.
  const resolved = mergeLines(
    looked.map(({ item, entry, quantity, clubHandle, override }) => ({
      handle: item.handle,
      size: item.size.slice(0, 80),
      quantity,
      priceId: override ? override.priceId : entry.priceId,
      name: entry.name,
      unitAmount: override ? override.unitAmount : entry.unitAmount,
      clubName: typeof item.clubName === 'string' ? item.clubName.slice(0, 100) : undefined,
      clubHandle,
    }))
  );
  if (resolved.length > CHECKOUT_MAX_LINES) {
    return res.status(400).json({ error: `Your basket has more than ${CHECKOUT_MAX_LINES} different items — please split it into two orders.` });
  }
  const clubHandles = resolved.map((i) => i.clubHandle);
  if (!isBankTransfer(clubHandles)) {
    return res.status(400).json({
      error: 'Pay by bank transfer is only available when your basket is all kit from one bank-transfer club shop — check out the other items separately.',
    });
  }
  const club = [...new Set(resolved.map((i) => i.clubName).filter(Boolean))].join(', ');
  const clubHandle = [...new Set(clubHandles.filter((h) => h && h !== 'protonlab'))].join(', ');
  const subtotal = resolved.reduce((sum, i) => sum + (i.unitAmount || 0) * i.quantity, 0);

  // ── Customer ──────────────────────────────────────────────────────────
  const name = str(customer?.name, 100);
  const email = str(customer?.email, 200).toLowerCase();
  const phone = str(customer?.phone, 40);
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'Please enter a phone number we can reach you on.' });

  // ── Delivery: same three modes as checkout, decided from the handles ───
  const clubDelivery = isClubDelivery(clubHandles);
  const wantsCollection = delivery === 'collection';
  const collection = !clubDelivery && wantsCollection && isCollectionOption(clubHandles);
  if (wantsCollection && !collection && !clubDelivery) {
    return res.status(400).json({
      error: `${COLLECTION_LABEL} is only available when your basket is all club kit from one club — choose standard delivery instead.`,
    });
  }
  let shipping = null;
  let shippingRegion = 'uk';
  let shippingMethod = 'standard';
  let shippingAmount = 0;
  let deliveryMode = 'post';
  if (clubDelivery) {
    deliveryMode = 'club';
    shippingMethod = 'club';
  } else if (collection) {
    deliveryMode = 'collection';
    shippingMethod = 'collection';
  } else {
    const a = address && typeof address === 'object' ? address : {};
    const country = str(a.country, 2).toUpperCase();
    const addr = {
      line1: str(a.line1, 200),
      line2: str(a.line2, 200),
      city: str(a.city, 100),
      state: str(a.state, 100),
      postal_code: str(a.postal_code, 20),
      country,
    };
    if (!addr.line1) return res.status(400).json({ error: 'Please enter the first line of your delivery address.' });
    if (!addr.city) return res.status(400).json({ error: 'Please enter your town or city.' });
    if (!addr.postal_code) return res.status(400).json({ error: 'Please enter your postcode.' });
    shippingRegion = regionForCountry(country);
    if (!shippingRegion) return res.status(400).json({ error: 'We currently deliver to the UK, Ireland and Europe only.' });
    // The zone's standard option in GBP (free at/over the threshold, like Stripe).
    const option = ZONES[shippingRegion].optionsFor(subtotal, 'gbp')[0].shipping_rate_data;
    shippingAmount = option.fixed_amount.amount;
    shippingMethod = option.metadata.evri_service;
    shipping = { name, phone, address: addr };
  }
  const amount = subtotal + shippingAmount;

  const attr = attribution && typeof attribution === 'object' ? attribution : null;
  const attrStr = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const configured = { store: isStoreConfigured(), details: !!bankDetails() };
  const created = new Date();
  const payBy = new Date(created.getTime() + PAY_WITHIN_DAYS * 86400000);
  const fields = {
    created: created.toISOString(),
    club,
    clubHandle,
    name,
    email,
    phone,
    delivery: deliveryMode,
    shippingMethod,
    shippingRegion,
    shipping,
    lines: resolved.map((i) => ({ handle: i.handle, name: i.name, size: i.size, qty: i.quantity, unitAmount: i.unitAmount })),
    subtotal,
    shippingAmount,
    amount,
    currency: 'gbp',
    payBy: payBy.toISOString(),
    paidAt: null,
    paidEmailAt: null,
    productionAt: null,
    dispatchedAt: null,
    tracking: null,
    deliveredAt: null,
    cancelledAt: null,
    attribution: {
      utm_source: attrStr(attr?.utm_source).toLowerCase(),
      utm_medium: attrStr(attr?.utm_medium).toLowerCase(),
      utm_campaign: attrStr(attr?.utm_campaign),
      referrer: attrStr(attr?.referrer, 200),
      attributed: attr ? '1' : '',
    },
    fbp: typeof fbp === 'string' ? fbp.slice(0, 100) : '',
    fbc: typeof fbc === 'string' ? fbc.slice(0, 500) : '',
    gaClientId: typeof gaClientId === 'string' ? gaClientId.slice(0, 100) : '',
    gaSessionId: typeof gaSessionId === 'string' ? gaSessionId.slice(0, 100) : '',
    clientIp,
    clientUa,
    emails: {},
  };

  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dryRun: true,
      configured,
      club,
      delivery: deliveryMode,
      shippingMethod,
      shippingRegion,
      subtotal: minorToMoney(subtotal),
      shippingAmount: minorToMoney(shippingAmount),
      amount: minorToMoney(amount),
      payBy: fields.payBy,
      lines: fields.lines,
    });
  }

  if (!configured.store || !configured.details) {
    console.error('bank-transfer-order not configured:', configured);
    await sendOpsAlert('Bank-transfer order REFUSED — not configured', [
      `Store (BLOB_READ_WRITE_TOKEN): ${configured.store ? 'ok' : 'MISSING'}`,
      `Bank details (config/bank.js, or BANK_* env overrides): ${configured.details ? 'ok' : 'MISSING'}`,
      `Club: ${club || '—'} · ${email}`,
      'A customer just tried to order — fill in config/bank.js (or the Blob store token in Vercel) and redeploy.',
    ]);
    return res.status(503).json({ error: "Bank-transfer ordering isn't set up yet — please email info@protonlab.cc and we'll take your order by hand." });
  }

  let rec;
  try {
    rec = await createBankOrder(fields);
  } catch (err) {
    console.error('bank-transfer-order store failed:', err);
    await sendOpsAlert('Bank-transfer order FAILED to store', [
      `Error: ${err.message}`,
      `Club: ${club || '—'} · ${email}`,
      `Cart: ${resolved.map((i) => `${i.handle} ${i.size} x${i.quantity}`).join(', ')}`,
      'The customer saw "Could not place your order" — investigate the Blob store now.',
    ]);
    return res.status(500).json({ error: 'Could not place your order — please try again in a moment.' });
  }

  // Emails never fail the order: the record exists, the dashboard can resend.
  const order = emailOrder(rec);
  const [received, internal] = await Promise.all([
    sendBankTransferReceived(order).catch((e) => ({ ok: false, error: e.message })),
    sendInternalNotification(order).catch((e) => ({ ok: false, error: e.message })),
  ]);
  if (!received.ok) {
    console.error('bank-transfer received email failed for', rec.id, received);
    await sendOpsAlert(`Bank-transfer order ${rec.payRef}: payment-details email FAILED`, [
      `Order: ${refOf(rec)} · ${email}`,
      `Error: ${received.error || received.skipped}`,
      'Use "Resend payment email" on the dashboard once Resend is reachable.',
    ]);
  }
  if (!internal?.ok) console.error('bank-transfer internal notification failed for', rec.id, internal);
  try {
    await updateBankOrder(rec.id, { emails: { received: received.ok ? 'ok' : 'failed', receivedAt: new Date().toISOString() } });
  } catch (err) {
    console.error('bank-transfer email stamp failed for', rec.id, err.message);
  }

  return res.status(200).json({
    ok: true,
    id: rec.id,
    ref: refOf(rec),
    payRef: rec.payRef,
    club,
    clubHandle,
    amount: minorToMoney(amount),
    subtotal: minorToMoney(subtotal),
    shippingAmount: minorToMoney(shippingAmount),
    delivery: deliveryMode,
    payBy: rec.payBy,
    bank: bankDetails(),
    email,
    emailed: !!received.ok,
  });
}
