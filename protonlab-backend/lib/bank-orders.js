// lib/bank-orders.js
// The store for club-shop orders paid by BANK TRANSFER (config/shipping.js
// BANK_TRANSFER_CLUBS). Stripe holds every card order; these never touch
// Stripe, so they live as one private JSON blob per order in the project's
// Vercel Blob store (`bank-orders/bt_NNNNN.json`, token BLOB_READ_WRITE_TOKEN,
// injected once the store is connected to protonlab-backend in Vercel).
//
// Lifecycle: api/bank-transfer-order.js creates the record and emails the
// member Proton Lab's account details with the unique payment reference
// PL-NNNNN; the order dashboard shows it beside the Stripe orders with a
// "Payment received" tick that api/admin.js {action:'mark-paid'} stamps as
// `paidAt` (Elijah ticks it when the transfer lands — nothing is automatic);
// dispatch / status / update-order / production / cancel-order act on the
// same record through admin.js, which routes ids by the `bt_` prefix.
//
// Reads use get({useCache:false}) so a tick is visible on the next feed load;
// list() + one get per order is fine at club-shop volumes (~1 s per 100).

import { put, get, list } from '@vercel/blob';
import { summariseItems } from './order-items.js';
import { COLLECTION_LABEL } from '../config/shipping.js';
import { BANK_DETAILS } from '../config/bank.js';

export const BANK_ORDER_PREFIX = 'bank-orders/';
export const PAY_WITHIN_DAYS = 7;
const ID_RE = /^bt_\d{5}$/;

export function isBankOrderId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function isStoreConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Proton Lab's own account the customer pays INTO (never anything of the
// customer's): config/bank.js, which the BANK_* environment variables
// override when set. null until name, sort code and account number are all
// present — the endpoint refuses orders until then.
export function bankDetails() {
  const v = (k, fallback) => (process.env[k] || fallback || '').trim();
  const accountName = v('BANK_ACCOUNT_NAME', BANK_DETAILS.accountName);
  const sortCode = v('BANK_SORT_CODE', BANK_DETAILS.sortCode);
  const accountNumber = v('BANK_ACCOUNT_NUMBER', BANK_DETAILS.accountNumber);
  if (!accountName || !sortCode || !accountNumber) return null;
  const iban = v('BANK_IBAN', BANK_DETAILS.iban);
  const bic = v('BANK_BIC', BANK_DETAILS.bic);
  return { accountName, sortCode, accountNumber, ...(iban ? { iban } : {}), ...(bic ? { bic } : {}) };
}

const pathOf = (id) => `${BANK_ORDER_PREFIX}${id}.json`;
const BLOB_OPTS = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };

async function readJson(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return JSON.parse(text);
}

export async function getBankOrder(id) {
  if (!isBankOrderId(id)) return null;
  return readJson(pathOf(id));
}

// Every order, newest first (cancelled ones included — callers filter).
export async function listBankOrders() {
  const paths = [];
  let cursor;
  do {
    const page = await list({ prefix: BANK_ORDER_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs || []) if (b.pathname.endsWith('.json')) paths.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const out = [];
  for (let i = 0; i < paths.length; i += 10) {
    const batch = await Promise.all(
      paths.slice(i, i + 10).map((p) =>
        readJson(p).catch((err) => {
          console.error('bank order read failed:', p, err.message);
          return null;
        })
      )
    );
    for (const rec of batch) if (rec && isBankOrderId(rec.id)) out.push(rec);
  }
  out.sort((a, b) => String(b.created).localeCompare(String(a.created)));
  return out;
}

// 5-digit numbers like Stripe's hashed order numbers, so "<Club> #NNNNN" reads
// the same on the dashboard; the pathname is the uniqueness check (a clash
// with a Stripe number is cosmetic — different id namespaces).
const randomNumber = () => String(10000 + Math.floor(Math.random() * 90000));

export async function createBankOrder(fields) {
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = randomNumber();
    const id = `bt_${number}`;
    const rec = { v: 1, id, number, payRef: `PL-${number}`, ...fields };
    try {
      await put(pathOf(id), JSON.stringify(rec), { ...BLOB_OPTS, allowOverwrite: false });
      return rec;
    } catch (err) {
      lastErr = err;
      const taken = /already exists|allowOverwrite/i.test(String(err?.message)) || /exists/i.test(String(err?.name));
      if (!taken) throw err;
    }
  }
  throw lastErr || new Error('Could not allocate an order number');
}

// Read → merge → overwrite. `patch` may be an object or a function of the
// current record (for stamps that depend on what is already there).
export async function updateBankOrder(id, patch) {
  const rec = await getBankOrder(id);
  if (!rec) return null;
  const next = { ...rec, ...(typeof patch === 'function' ? patch(rec) : patch), updatedAt: new Date().toISOString() };
  await put(pathOf(id), JSON.stringify(next), { ...BLOB_OPTS, allowOverwrite: true });
  return next;
}

// ─── Shapes the rest of the backend expects ─────────────────────────────────

export const minorToMoney = (v) => (Number(v || 0) / 100).toFixed(2);

export function refOf(rec) {
  return rec.club ? `${rec.club} #${rec.number}` : `Order #${rec.number}`;
}

function lineItemsOf(rec) {
  return (rec.lines || []).map((l) => ({ handle: l.handle, name: l.name, size: l.size, qty: l.qty, unitAmount: l.unitAmount }));
}

export function shippingLabelOf(rec) {
  const m = rec.shippingMethod || 'standard';
  if (m === 'club') return 'Club delivery';
  if (m === 'collection') return COLLECTION_LABEL;
  const free = !(Number(rec.shippingAmount) > 0);
  if (m === 'international') return free ? 'Free European Delivery' : 'European Delivery';
  return free ? 'Free Standard Delivery' : 'Standard Delivery';
}

// The api/admin.js JSON-feed entry (same keys as a Stripe order, l.730-752
// there) plus the payment fields the dashboard's tick reads.
export function feedEntry(rec) {
  const raw = rec.shipping?.address || {};
  const addr = {
    line1: raw.line1 || '',
    line2: raw.line2 || '',
    city: raw.city || '',
    state: raw.state || '',
    postal_code: raw.postal_code || '',
    country: raw.country || '',
  };
  const lines = lineItemsOf(rec);
  return {
    id: rec.id,
    club: rec.club || '',
    ref: refOf(rec),
    date: rec.created,
    name: rec.name || '—',
    email: rec.email || '',
    phone: rec.phone || '',
    addr,
    address: [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean).join(', '),
    place: [addr.city, addr.postal_code].filter(Boolean).join(', ') || '—',
    shippingName: rec.shipping?.name || '',
    items: lines.length ? summariseItems(lines, Infinity) : '—',
    clubHandle: rec.clubHandle || '',
    lineItems: lines,
    shippingAmount: minorToMoney(rec.shippingAmount),
    discountAmount: '0.00',
    promoCode: '',
    amount: minorToMoney(rec.amount),
    symbol: '£',
    service: rec.shippingMethod || 'standard',
    productionAt: rec.productionAt || null,
    dispatchedAt: rec.dispatchedAt || null,
    deliveredAt: rec.deliveredAt || null,
    tracking: rec.tracking || null,
    payment: 'bank-transfer',
    paid: !!rec.paidAt,
    paidAt: rec.paidAt || null,
    payRef: rec.payRef,
    payBy: rec.payBy,
  };
}

// The order object the email templates (emails/*.js) and
// lib/email.js sendInternalNotification expect — the webhook's shape plus
// the bank-transfer fields the two bank templates read.
export function emailOrder(rec) {
  const lines = lineItemsOf(rec);
  return {
    id: rec.id,
    ref: refOf(rec),
    number: rec.number,
    amount: minorToMoney(rec.amount),
    currency: 'GBP',
    email: rec.email,
    name: rec.name || 'N/A',
    phone: rec.phone || 'N/A',
    club: rec.club || 'N/A',
    product: lines.length ? summariseItems(lines) : 'your order',
    lineItems: lines,
    shipping: rec.shipping || null,
    shippingMethod: rec.shippingMethod || 'standard',
    shippingLabel: shippingLabelOf(rec),
    shippingAmount: minorToMoney(rec.shippingAmount),
    discountAmount: '0.00',
    promoCode: '',
    date: rec.created,
    payment: 'bank-transfer',
    payRef: rec.payRef,
    payBy: rec.payBy,
    paidAt: rec.paidAt || null,
    bank: bankDetails(),
  };
}
