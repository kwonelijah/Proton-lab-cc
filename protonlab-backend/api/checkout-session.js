// api/checkout-session.js
// Minimal, non-PII order summary for a completed Stripe Checkout Session.
// The /success page on protonlab.cc calls this to fire the browser-side Meta
// Purchase event with the real order total (shipping and discounts are applied
// on Stripe's hosted page, so the client never knew the final amount).
// Returns only value/currency/item handles — no names, emails or addresses.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    return res.status(200).json({
      value: (session.amount_total ?? 0) / 100,
      currency: (session.currency || 'gbp').toUpperCase(),
      contentIds: items.map(i => i.handle).filter(Boolean),
      numItems: items.reduce((sum, i) => sum + (i.qty || 1), 0),
    });
  } catch {
    return res.status(404).json({ error: 'Not found' });
  }
}
