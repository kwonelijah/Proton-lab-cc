// api/export-evri.js
// On-demand Evri bulk-despatch CSV export. Reads orders straight from Stripe
// (the system of record — no Google Sheet or database needed) and returns a
// downloadable CSV ready to upload to Evri's bulk import.
//
// Usage:
//   GET /api/export-evri?key=<proton_export_key>&since=30&club=<optional substring>
//     key   — required, must match the proton_export_key env var (set in Vercel)
//     since — optional, days back (e.g. 30) OR an ISO date (2026-06-01). Default 60.
//     club  — optional, case-insensitive substring filter on the club name
//
// Weight is intentionally left blank for now (fill in Evri's portal, or wire up
// per-item weights in a later pass). Service defaults to Standard.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Same deterministic order number used in the order emails (webhook.js).
function orderNumber(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 100000;
  }
  return String(h).padStart(5, '0');
}

const COUNTRY_NAMES = { GB: 'United Kingdom', IE: 'Ireland' };

// Evri standard bulk columns — adjust these to match your portal's template if needed.
const HEADERS = [
  'Name',
  'Address Line 1',
  'Address Line 2',
  'Town/City',
  'County',
  'Postcode',
  'Country',
  'Email',
  'Phone',
  'Weight (kg)',
  'Contents',
  'Value (GBP)',
  'Service',
  'Reference',
  'Quantity',
];

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseSince(since) {
  if (!since) return Math.floor((Date.now() - 60 * 86400000) / 1000);
  if (/^\d+$/.test(since)) return Math.floor((Date.now() - Number(since) * 86400000) / 1000);
  const t = Date.parse(since);
  return Number.isNaN(t) ? Math.floor((Date.now() - 60 * 86400000) / 1000) : Math.floor(t / 1000);
}

function contentsFromMetadata(meta) {
  try {
    const items = JSON.parse(meta?.items || '[]');
    if (Array.isArray(items) && items.length) {
      return items
        .map((i) => `${i.name || i.handle}${i.size ? ` (${i.size})` : ''}${i.qty > 1 ? ` x${i.qty}` : ''}`)
        .join(', ');
    }
  } catch {
    /* fall through */
  }
  return meta?.product || 'Cycling apparel';
}

export default async function handler(req, res) {
  const expected = process.env.proton_export_key;
  if (!expected) {
    return res.status(500).json({ error: 'EXPORT_KEY_MISSING: set proton_export_key in the environment' });
  }
  if (req.query.key !== expected) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sinceTs = parseSince(req.query.since);
  const clubFilter = (req.query.club || '').toString().trim().toLowerCase();

  let payments;
  try {
    payments = await stripe.paymentIntents
      .list({ created: { gte: sinceTs }, limit: 100 })
      .autoPagingToArray({ limit: 1000 });
  } catch (err) {
    console.error('Stripe list error:', err);
    return res.status(502).json({ error: 'Failed to read orders from Stripe' });
  }

  const rows = [];
  for (const p of payments) {
    if (p.status !== 'succeeded') continue;
    const meta = p.metadata || {};
    const club = meta.club || '';
    if (clubFilter && !club.toLowerCase().includes(clubFilter)) continue;

    const ship = p.shipping || {};
    const addr = ship.address || {};
    const number = orderNumber(p.id);
    const ref = club ? `${club} #${number}` : `Order #${number}`;

    rows.push([
      ship.name || meta.name || '',
      addr.line1 || '',
      addr.line2 || '',
      addr.city || '',
      addr.state || '',
      addr.postal_code || '',
      COUNTRY_NAMES[addr.country] || addr.country || '',
      p.receipt_email || meta.email || '',
      ship.phone || '',
      '', // Weight (kg) — left blank for now
      contentsFromMetadata(meta),
      (p.amount / 100).toFixed(2),
      'Standard',
      ref,
      1, // one parcel per order
    ]);
  }

  const csv = [HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="evri-orders-${stamp}.csv"`);
  return res.status(200).send(csv);
}
