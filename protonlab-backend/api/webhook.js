// api/webhook.js
// Stripe webhook handler — Vercel serverless function
// Phase 1: Stripe only — logs orders to console, no Google Sheets yet
// Phase 2: uncomment the sheets + agent lines once Google is set up

import Stripe from 'stripe';
import { sendOrderConfirmation, sendInternalNotification } from '../lib/email.js';
// import { appendOrder } from '../lib/sheets.js';     // Phase 2
// import { processNewOrders } from '../lib/agent.js'; // Phase 2

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Deterministic 5-digit order number derived from the Stripe payment id, so the
// same order always yields the same reference without needing a stored counter.
function orderNumber(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 100000;
  }
  return String(h).padStart(5, '0');
}

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

    // Delivery address — Stripe Checkout copies the collected shipping address
    // onto the PaymentIntent's `shipping` field (name + address + phone).
    const shipping = payment.shipping || null;

    // Customer contact details. The email + phone the customer types on the Stripe
    // hosted page are stored on the Checkout Session (`customer_details`), NOT on
    // the PaymentIntent — so look up the session by payment_intent to recover them.
    let customer = null;
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: payment.id,
        limit: 1,
      });
      customer = sessions.data[0]?.customer_details || null;
    } catch (err) {
      console.error('Could not fetch checkout session for customer details:', err.message);
    }

    // Line items with sizes, captured at checkout: [{ name, handle, size, qty }]
    let lineItems = [];
    try {
      lineItems = JSON.parse(payment.metadata?.items || '[]');
    } catch {
      lineItems = [];
    }

    const club = payment.metadata?.club || 'N/A';

    // Human-friendly order reference: "<Club> #<number>". No DB/counter exists,
    // so the number is derived deterministically from the Stripe id (stable per
    // order, not a 1,2,3 sequence). The raw Stripe id is kept for lookup.
    const number = orderNumber(payment.id);
    const ref = club && club !== 'N/A' ? `${club} #${number}` : `Order #${number}`;

    const order = {
      id: payment.id,
      ref,
      number,
      amount: (payment.amount / 100).toFixed(2),
      currency: payment.currency.toUpperCase(),
      email: customer?.email || payment.receipt_email || payment.metadata?.email || 'N/A',
      name: customer?.name || payment.metadata?.name || shipping?.name || 'N/A',
      phone: customer?.phone || shipping?.phone || payment.metadata?.phone || 'N/A',
      club,
      product: payment.metadata?.product || 'N/A',
      lineItems,
      shipping,
      date: new Date().toISOString(),
    };

    console.log('✓ Payment received:', JSON.stringify(order, null, 2));

    // Stamp contact details onto the PaymentIntent so the admin listing can
    // read them directly instead of re-fetching the checkout session later.
    try {
      await stripe.paymentIntents.update(payment.id, {
        metadata: {
          customer_email: order.email !== 'N/A' ? order.email : '',
          customer_name: order.name !== 'N/A' ? order.name : '',
          customer_phone: order.phone !== 'N/A' ? order.phone : '',
        },
      });
    } catch (err) {
      console.error('Could not stamp customer metadata:', err.message);
    }

    await Promise.all([
      sendOrderConfirmation(order),
      sendInternalNotification(order),
    ]);

    // Phase 2: uncomment these once Google Sheets is configured
    // await appendOrder(order);
    // await processNewOrders([order]);
  }

  res.status(200).json({ received: true });
}
