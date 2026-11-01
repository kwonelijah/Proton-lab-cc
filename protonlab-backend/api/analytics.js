// api/analytics.js
// Read-only analytics feed for the order dashboard's Analytics tab. Every
// money figure comes from Stripe balance transactions (settled GBP, fees, net,
// FX) — never charge.amount — and every order carries its checkout line items
// so revenue can be split by SKU / colourway / size. The browser never talks
// to Stripe: it calls this with the same admin key as /api/admin.
//
// GET /api/analytics?key=<proton_export_key>&scope=…
//   scope=orders&since=<unix>&until=<unix>   paid orders created in the window
//        (client drives ≤93-day windows; &lite=1 returns mutable fields only —
//        refunds / dispatch / delivery stamps — for the weekly re-scan)
//   scope=changes&since=<unix>               refunds + disputes by THEIR OWN
//        created date, so a refund 70 days after purchase is never missed
//   scope=treasury                           balance + payouts (arrival date)
//   scope=funnel&start=YYYY-MM-DD&end=…      GA4 Data API users/events per day
//        for page_view / view_item / add_to_cart / begin_checkout / purchase
//
// Responses are cached per warm instance for 5 minutes (never errors), sent
// with Cache-Control: no-store, and the query string is never logged — rows
// carry emails and postcodes. Metric definitions live in ANALYTICS.md.

import Stripe from 'stripe';
import core from '../lib/analytics-core.cjs';
import { decodeItems, loadProductMap, effectiveShipping, hasShippingOverride } from '../lib/order-items.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_WINDOW_DAYS = 93;
const cache = new Map();

const round2 = core.round2;
const iso = (ts) => (ts ? new Date(ts * 1000).toISOString() : null);
// Metadata minor-unit strings (shipping_amount, discount_amount, subtotal) → pounds; absent → null.
const minor = (v) => (v == null || v === '' || !/^-?\d+$/.test(String(v)) ? null : Number(v) / 100);

// Same deterministic order number as the order emails and the admin feed.
function orderNumber(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return String(h).padStart(5, '0');
}

// ─── product index ──────────────────────────────────────────────────────────
// Line items are matched by Stripe PRODUCT id (stable; base, EUR and club
// prices of a handle share one product) with price id as a fallback —
// superseded prices are archived by scripts/stripe-sync.js --prune, so an
// order placed before a price change has a price id no map knows.
let indexCache = null;
function productIndex() {
  if (indexCache) return indexCache;
  const map = loadProductMap();
  const byProduct = {}, byPrice = {};
  for (const [handle, p] of Object.entries(map)) {
    if (p.productId) byProduct[p.productId] = handle;
    if (p.priceId) byPrice[p.priceId] = handle;
    if (p.eur?.priceId) byPrice[p.eur.priceId] = handle;
    for (const cp of Object.values(p.clubPrices || {})) if (cp?.priceId) byPrice[cp.priceId] = handle;
  }
  indexCache = { map, byProduct, byPrice };
  return indexCache;
}
function unitPriceFor(map, handle, clubKey, isEur) {
  const p = map[handle];
  return p?.clubPrices?.[clubKey]?.unitAmount ?? (isEur ? p?.eur?.unitAmount : undefined) ?? p?.unitAmount ?? null;
}

// ─── Stripe reads ───────────────────────────────────────────────────────────
async function listSucceededPIs(gte, lte, expand) {
  const params = { limit: 100 };
  if (expand) params.expand = expand;
  try {
    return await stripe.paymentIntents
      .search({ ...params, query: `status:'succeeded' AND created>=${gte} AND created<=${lte}` })
      .autoPagingToArray({ limit: 5000 });
  } catch (err) {
    // Search unavailable (or its index lagging) → plain list + filter. Pays for
    // the abandoned-checkout PIs too, but gives the same rows.
    console.error('paymentIntents.search failed, falling back to list:', err.message);
    const all = await stripe.paymentIntents
      .list({ ...params, created: { gte, lte } })
      .autoPagingToArray({ limit: 5000 });
    return all.filter((p) => p.status === 'succeeded');
  }
}
async function sessionsByPaymentIntent(gte, lte) {
  const sessions = await stripe.checkout.sessions
    .list({ created: { gte: gte - 86400, lte }, status: 'complete', limit: 100, expand: ['data.line_items'] })
    .autoPagingToArray({ limit: 5000 });
  const out = new Map();
  for (const s of sessions) {
    if (!s.payment_intent) continue;
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent.id;
    if (s.line_items?.has_more) {
      // Baskets over 10 lines: page the rest in.
      try {
        s.line_items.data = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100 }).autoPagingToArray({ limit: 500 });
      } catch (err) { console.error('listLineItems failed for', s.id, err.message); }
    }
    out.set(pi, s);
  }
  return out;
}

// ─── row builder ────────────────────────────────────────────────────────────
// Lines: the session's line items carry the money (amount_total is already
// discount-allocated by Stripe); sizes live in the PI metadata tuples. Tuples
// and line items were written from the same list at checkout, so sizes are
// matched by handle group then positionally. If anything diverges (an
// update-order rewrote the tuples, a product we can't map, no session for a
// legacy order) the fallback allocates (subtotal − discount) pro-rata by
// catalogue price and flags every line `allocated:true`.
function buildItems(p, session, idx, clubKey, isEur, fx) {
  const meta = p.metadata || {};
  const tuples = decodeItems(meta);
  const lines = session?.line_items?.data || null;
  if (lines && lines.length) {
    const queue = new Map();
    for (const t of tuples) { if (!queue.has(t.handle)) queue.set(t.handle, []); queue.get(t.handle).push({ ...t, left: Number(t.qty) || 0 }); }
    const out = [];
    let ok = true;
    for (const li of lines) {
      const price = li.price || {};
      const productId = typeof price.product === 'string' ? price.product : price.product?.id || null;
      const handle = (productId && idx.byProduct[productId]) || idx.byPrice[price.id] || null;
      if (!handle) { ok = false; break; }
      const qty = Number(li.quantity) || 0;
      const lineGbp = ((li.amount_total || 0) / 100) * fx;
      const q = queue.get(handle) || [];
      let left = qty;
      while (left > 0 && q.length) {
        const t = q[0];
        const take = Math.min(left, t.left);
        out.push({ handle, name: t.name || idx.map[handle]?.name || handle, size: t.size || '', qty: take, lineGbp: round2(qty ? (lineGbp * take) / qty : 0), productId });
        t.left -= take; left -= take;
        if (!t.left) q.shift();
      }
      if (left > 0) { ok = false; break; }
    }
    if (ok && ![...queue.values()].some((q) => q.length)) return out;
  }
  const priced = tuples.map((t) => {
    const u = unitPriceFor(idx.map, t.handle, clubKey, isEur);
    return { handle: t.handle, name: t.name || idx.map[t.handle]?.name || t.handle, size: t.size || '', qty: Number(t.qty) || 0, unit: u == null ? null : u / 100 };
  });
  const total = priced.reduce((s, t) => s + (t.unit == null ? 0 : t.unit * t.qty), 0);
  const subtotal = minor(meta.subtotal);
  const target = subtotal != null ? subtotal - (minor(meta.discount_amount) || 0) : null;   // charge currency
  const scale = target != null && total > 0 ? target / total : 1;
  return priced.map((t) => ({ handle: t.handle, name: t.name, size: t.size, qty: t.qty, lineGbp: round2((t.unit == null ? 0 : t.unit * t.qty) * scale * fx), allocated: true }));
}

function buildRow(p, session, idx) {
  const meta = p.metadata || {};
  const ch = p.latest_charge && typeof p.latest_charge === 'object' ? p.latest_charge : null;
  const bt = ch?.balance_transaction && typeof ch.balance_transaction === 'object' ? ch.balance_transaction : null;
  const fx = bt?.exchange_rate ? Number(bt.exchange_rate) : 1;
  const grossGbp = bt ? bt.amount / 100 : (p.amount / 100) * fx;
  const ship = effectiveShipping(p);
  const cd = session?.customer_details || null;
  const country = String(ship?.address?.country || cd?.address?.country || core.regionCountry(meta.shipping_region) || '').toUpperCase();
  const postal = ship?.address?.postal_code || cd?.address?.postal_code || '';
  const clubHandle = String(meta.club_handle || meta.club_id || '').split(',')[0].trim();
  const isEur = p.currency === 'eur';
  const pmd = ch?.payment_method_details || null;
  const paymentMethod = pmd ? (pmd.card?.wallet?.type ? `${pmd.card.brand} (${pmd.card.wallet.type})` : pmd.card?.brand || pmd.type || '') : '';
  const sh = minor(meta.shipping_amount), dc = minor(meta.discount_amount), st = minor(meta.subtotal);
  const number = orderNumber(p.id);
  const club = meta.club || '';
  return {
    id: p.id,
    source: 'stripe',
    ref: club && club !== 'Proton Lab' ? `${club} #${number}` : `Order #${number}`,
    sessionId: session?.id || null,
    created: iso(p.created),
    paidAt: iso(ch?.created || p.created),
    availableOn: iso(bt?.available_on),
    currency: p.currency,
    channel: core.channelOfMeta(meta),
    clubHandle,
    club,
    email: core.normEmail(meta.customer_email || cd?.email || p.receipt_email || meta.email),
    phone: meta.customer_phone || cd?.phone || ship?.phone || '',
    name: meta.customer_name || ship?.name || cd?.name || meta.name || '',
    country,
    postcodeArea: core.postcodeArea(postal, country),
    gross: round2(p.amount / 100),
    grossGbp: round2(grossGbp),
    fee: round2(bt ? bt.fee / 100 : 0),
    net: round2(bt ? bt.net / 100 : grossGbp),
    fx,
    shippingGbp: round2(sh != null ? sh * fx : session?.shipping_cost ? ((session.shipping_cost.amount_total || 0) / 100) * fx : 0),
    discountGbp: round2(dc != null ? dc * fx : session?.total_details ? ((session.total_details.amount_discount || 0) / 100) * fx : 0),
    subtotalGbp: st != null ? round2(st * fx) : session ? round2(((session.amount_subtotal || 0) / 100) * fx) : null,
    promoCode: meta.promo_code || '',
    refundedGbp: round2(((ch?.amount_refunded || 0) / 100) * fx),
    dispute: null,                       // merged client-side from scope=changes
    items: buildItems(p, session, idx, clubHandle, isEur, fx),
    utm: core.attributionOfMeta(meta),
    shippingMethod: meta.shipping_method || 'standard',
    delivery: meta.delivery || 'post',
    paymentMethod,
    tracking: meta.tracking || null,
    productionAt: meta.production_notified_at || null,
    dispatchedAt: meta.dispatched_at || null,
    deliveredAt: meta.delivered_at || null,
  };
}
function liteRow(p) {
  const meta = p.metadata || {};
  const ch = p.latest_charge && typeof p.latest_charge === 'object' ? p.latest_charge : null;
  const bt = ch?.balance_transaction && typeof ch.balance_transaction === 'object' ? ch.balance_transaction : null;
  const fx = bt?.exchange_rate ? Number(bt.exchange_rate) : 1;
  return {
    id: p.id,
    refundedGbp: round2(((ch?.amount_refunded || 0) / 100) * fx),
    tracking: meta.tracking || null,
    productionAt: meta.production_notified_at || null,
    dispatchedAt: meta.dispatched_at || null,
    deliveredAt: meta.delivered_at || null,
    shipOverride: hasShippingOverride(meta),
  };
}

// ─── scopes ─────────────────────────────────────────────────────────────────
function windowOf(q) {
  const gte = Number(q.since) || 0;
  const lte = Number(q.until) || Math.floor(Date.now() / 1000);
  if (!gte) throw Object.assign(new Error('since (unix seconds) is required'), { status: 400 });
  if (lte < gte) throw Object.assign(new Error('until is before since'), { status: 400 });
  if (lte - gte > MAX_WINDOW_DAYS * 86400) throw Object.assign(new Error(`window too large — max ${MAX_WINDOW_DAYS} days per call`), { status: 400 });
  return { gte, lte };
}
async function ordersScope(q) {
  const { gte, lte } = windowOf(q);
  const expand = ['data.latest_charge.balance_transaction'];
  const pis = await listSucceededPIs(gte, lte, expand);
  if (q.lite === '1') return { lite: true, since: gte, until: lte, count: pis.length, orders: pis.map(liteRow) };
  const [sessions, idx] = [await sessionsByPaymentIntent(gte, lte), productIndex()];
  const orders = pis.map((p) => buildRow(p, sessions.get(p.id) || null, idx));
  return { since: gte, until: lte, count: orders.length, orders };
}
async function changesScope(q) {
  const gte = Number(q.since) || 0;
  if (!gte) throw Object.assign(new Error('since (unix seconds) is required'), { status: 400 });
  const refunds = await stripe.refunds.list({ created: { gte }, limit: 100, expand: ['data.balance_transaction'] }).autoPagingToArray({ limit: 5000 });
  const disputes = await stripe.disputes.list({ created: { gte }, limit: 100 }).autoPagingToArray({ limit: 5000 });
  const piOf = (v) => (typeof v === 'string' ? v : v?.id || null);
  return {
    since: gte,
    refunds: refunds.map((f) => {
      const bt = f.balance_transaction && typeof f.balance_transaction === 'object' ? f.balance_transaction : null;
      return {
        id: f.id, created: iso(f.created), paymentIntent: piOf(f.payment_intent), charge: piOf(f.charge),
        amount: round2(f.amount / 100), currency: f.currency,
        // The refund's own balance transaction is negative in the settlement currency.
        amountGbp: bt ? round2(-bt.amount / 100) : f.currency === 'gbp' ? round2(f.amount / 100) : null,
        reason: f.reason || '', status: f.status || '',
      };
    }),
    disputes: disputes.map((d) => {
      const bts = Array.isArray(d.balance_transactions) ? d.balance_transactions : [];
      const withdrawal = bts.length ? Math.min(...bts.map((b) => b.amount)) : null;
      return {
        id: d.id, created: iso(d.created), paymentIntent: piOf(d.payment_intent), charge: piOf(d.charge),
        amount: round2(d.amount / 100), currency: d.currency,
        amountGbp: withdrawal != null && withdrawal < 0 ? round2(-withdrawal / 100) : d.currency === 'gbp' ? round2(d.amount / 100) : null,
        netGbp: round2(bts.reduce((s, b) => s + (b.net || 0), 0) / 100),
        reason: d.reason || '', status: d.status || '',
        evidenceDueBy: iso(d.evidence_details?.due_by),
      };
    }),
  };
}
async function treasuryScope(q) {
  const gte = Number(q.since) || Math.floor(Date.now() / 1000) - 400 * 86400;
  const balance = await stripe.balance.retrieve();
  const payouts = await stripe.payouts.list({ arrival_date: { gte }, limit: 100 }).autoPagingToArray({ limit: 2000 });
  const money = (list) => (list || []).map((b) => ({ currency: b.currency, amount: round2(b.amount / 100) }));
  return {
    balance: { available: money(balance.available), pending: money(balance.pending), livemode: balance.livemode },
    payouts: payouts.map((p) => ({ id: p.id, arrivalDate: iso(p.arrival_date), created: iso(p.created), amount: round2(p.amount / 100), currency: p.currency, status: p.status, automatic: !!p.automatic })),
  };
}
const GA4_EVENTS = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase'];
async function funnelScope(q) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(q.end || '') ? q.end : new Date().toISOString().slice(0, 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(q.start || '') ? q.start : core.addDays(end, -89);
  let credentials = null;
  try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''); } catch { /* not configured */ }
  const serviceAccount = credentials?.client_email || null;
  const property = process.env.GA4_PROPERTY_ID;
  if (!credentials || !property) return { error: 'GA4_NOT_CONFIGURED', serviceAccount, start, end, days: null };
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
    const ad = google.analyticsdata({ version: 'v1beta', auth });
    const resp = await ad.properties.runReport({
      property: `properties/${property}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: GA4_EVENTS, caseSensitive: true } } },
        limit: '100000',
        keepEmptyRows: false,
      },
    });
    const days = new Map();
    for (const row of resp.data.rows || []) {
      const raw = row.dimensionValues?.[0]?.value || '';
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      const ev = row.dimensionValues?.[1]?.value;
      if (!GA4_EVENTS.includes(ev)) continue;
      const d = days.get(date) || { date };
      d[ev] = { events: Number(row.metricValues?.[0]?.value || 0), users: Number(row.metricValues?.[1]?.value || 0) };
      days.set(date, d);
    }
    return { start, end, serviceAccount, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code === 403 || code === 401 || code === 404) return { error: 'GA4_NOT_CONFIGURED', serviceAccount, start, end, days: null, detail: String(err.message || '').slice(0, 300) };
    throw err;
  }
}

// ─── handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.proton_export_key;
  if (!expected) return res.status(500).json({ error: 'EXPORT_KEY_MISSING: set proton_export_key in the environment' });
  if (req.query.key !== expected) return res.status(403).json({ error: 'Forbidden' });

  const q = req.query || {};
  const scope = q.scope || 'orders';
  const cacheKey = JSON.stringify([scope, q.since, q.until, q.lite, q.start, q.end]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return res.status(200).json({ ...hit.body, cached: true });

  const serverTime = new Date().toISOString();
  try {
    let body;
    if (scope === 'orders') body = await ordersScope(q);
    else if (scope === 'changes') body = await changesScope(q);
    else if (scope === 'treasury') body = await treasuryScope(q);
    else if (scope === 'funnel') body = await funnelScope(q);
    else return res.status(400).json({ error: `Unknown scope '${scope}' — use orders, changes, treasury or funnel` });
    body.scope = scope;
    body.serverTime = serverTime;
    if (!body.error) cache.set(cacheKey, { at: Date.now(), body });
    return res.status(200).json(body);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error(`analytics ${scope} failed:`, err.message);   // never the query string — it carries the key
    return res.status(502).json({ error: `Analytics ${scope} failed: ${err.message}` });
  }
}

// Exported for tests.
export const _internal = { buildRow, buildItems, productIndex, liteRow, orderNumber, clearCache: () => cache.clear() };
