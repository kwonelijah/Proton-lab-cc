// api/create-checkout-session.js
// Creates a Stripe Hosted Checkout session and returns the redirect URL
// Called from protonlab.cc frontend when a customer clicks "Buy"

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, customerEmail, customerName } = req.body;

  // items = [{ name: 'Product Name', price: 4999, quantity: 1 }]
  // price is in cents (e.g. $49.99 = 4999)

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',

      // Pre-fill customer email if you already have it
      customer_email: customerEmail || undefined,

      // Line items — one per product in the cart
      line_items: items.map((item) => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.name,
            description: item.description || undefined,
            images: item.image ? [item.image] : undefined,
          },
          unit_amount: item.price, // in cents
        },
        quantity: item.quantity || 1,
      })),

      // Pass customer info through to the webhook via metadata
      payment_intent_data: {
        metadata: {
          name: customerName || '',
          email: customerEmail || '',
          product: items.map((i) => i.name).join(', '),
        },
      },

      // Where to send the customer after payment
      success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/cancel`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
