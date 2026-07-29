// api/checkout-session.js
// Minimal, non-PII order summary for a completed Stripe Checkout Session.
// The /success page on protonlab.cc calls this to fire the browser-side Meta
// Purchase event with the real order total (shipping and discounts are applied
// on Stripe's hosted page, so the client never knew the final amount).
// Returns only value/currency/item handles — no names, emails or addresses.

import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Unit prices for analytics item data — same source create-checkout-session
// prices from, so reported item prices always match what was charged.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

let productMap = null;
function loadProductMap() {
  if (productMap) return productMap;
  try {
    productMap = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  } catch {
    productMap = {};
  }
  return productMap;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    if (session.payment_status !== 'paid') {
      return res.status(404).json({ error: 'Not found' });
    }

    let items = [];
    try {
      items = JSON.parse(session.payment_intent?.metadata?.items || '[]');
    } catch {
      items = [];
    }

    // Storefront channel — retail orders carry club metadata "Proton Lab";
    // any other club name means the order came through a club store.
    const club = session.payment_intent?.metadata?.club || '';
    const map = loadProductMap();

    return res.status(200).json({
      value: (session.amount_total ?? 0) / 100,
      currency: (session.currency || 'gbp').toUpperCase(),
      contentIds: items.map(i => i.handle).filter(Boolean),
      numItems: items.reduce((sum, i) => sum + (i.qty || 1), 0),
      channel: club && club !== 'Proton Lab' ? 'club-shop' : 'retail',
      // Full line items so GA4 purchases attribute to named products.
      // Still no PII — names/prices are public catalogue data.
      items: items
        .filter(i => i.handle)
        .map(i => ({
          id: i.handle,
          name: i.name || map[i.handle]?.name || i.handle,
          quantity: i.qty || 1,
          price: map[i.handle]?.unitAmount != null ? map[i.handle].unitAmount / 100 : undefined,
        })),
    });
  } catch {
    return res.status(404).json({ error: 'Not found' });
  }
}
