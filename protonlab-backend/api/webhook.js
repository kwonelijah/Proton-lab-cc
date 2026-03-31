// api/webhook.js
// Stripe webhook handler — Vercel serverless function
// Phase 1: Stripe only — logs orders to console, no Google Sheets yet
// Phase 2: uncomment the sheets + agent lines once Google is set up

import Stripe from 'stripe';
// import { appendOrder } from '../lib/sheets.js';     // Phase 2
// import { processNewOrders } from '../lib/agent.js'; // Phase 2

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel requires raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const payment = event.data.object;

    const order = {
      id: payment.id,
      amount: (payment.amount / 100).toFixed(2),
      currency: payment.currency.toUpperCase(),
      email: payment.receipt_email || payment.metadata?.email || 'N/A',
      name: payment.metadata?.name || 'N/A',
      product: payment.metadata?.product || 'N/A',
      date: new Date().toISOString(),
    };

    // Phase 1: just log the order — check Vercel logs to confirm it's working
    console.log('✓ Payment received:', JSON.stringify(order, null, 2));

    // Phase 2: uncomment these once Google Sheets is configured
    // await appendOrder(order);
    // await processNewOrders([order]);
  }

  res.status(200).json({ received: true });
}
