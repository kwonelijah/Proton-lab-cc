/* eslint-disable */
// scripts/test-checkout.js
// Creates a real Stripe Checkout Session using the same lookup logic as the
// backend, so we can verify the hosted Checkout page renders prices + sizes
// without needing the backend to be deployed.
//
// Run: node scripts/test-checkout.js

const fs = require('fs');
const path = require('path');

function loadDotEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

function loadStripe() {
  try { return require('stripe'); }
  catch (_) {
    return require(path.resolve(__dirname, '..', 'protonlab-backend', 'node_modules', 'stripe'));
  }
}

const Stripe = loadStripe();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const mapping = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'data', 'stripe-products.json'), 'utf8')
);

const items = [
  { handle: 'ss-race-jersey',      size: 'M',  quantity: 1 },
  { handle: 'race-bib-shorts',     size: 'L',  quantity: 2 },
  { handle: 'aero-socks',          size: 'S',  quantity: 1 },
];

async function main() {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: items.map(i => {
      const entry = mapping[i.handle];
      if (!entry) throw new Error(`Unknown handle: ${i.handle}`);
      return {
        price: entry.priceId,
        quantity: i.quantity,
      };
    }),
    custom_text: {
      submit: {
        message: 'Sizes: ' + items.map(i => `${mapping[i.handle].name} — ${i.size}`).join(', '),
      },
    },
    payment_intent_data: {
      metadata: {
        name: 'Test Customer',
        email: 'test@example.com',
        product: items.map(i => mapping[i.handle].name).join(', '),
        items: JSON.stringify(items.map(i => ({ handle: i.handle, size: i.size, qty: i.quantity }))),
      },
    },
    success_url: 'https://protonlab.cc/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://protonlab.cc/cancel',
  });
  console.log(JSON.stringify({ id: session.id, url: session.url }, null, 2));
}

main().catch(err => {
  console.error('test-checkout failed:', err.message);
  process.exit(1);
});
