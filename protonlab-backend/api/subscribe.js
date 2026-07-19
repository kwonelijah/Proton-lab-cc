// api/subscribe.js
// Newsletter signup: adds the address to the Resend audience, issues a unique
// single-use 10% welcome code (retail range only), logs the signup to the
// Subscribers sheet tab, and emails the code. The code is only ever delivered
// by email — that's what proves the address is real.
//
// POST { email, source } — source is 'popup' | 'footer' (display only).
// Responses are deliberately shaped for the frontend forms:
//   200 { ok: true }                    — subscribed, code on its way
//   200 { ok: true, already: true }     — was already on the list (no new code)
//   400 { error }                       — bad email
//
// The `website` field is a honeypot: humans never see it, bots fill it in.
// Bot submissions get a silent 200 and nothing happens.

import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendSubscriber, getSubscriberEmails } from '../lib/sheets.js';
import { sendWelcome } from '../lib/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

// ─── Welcome coupon ──────────────────────────────────────────────────────────
// One shared 10% coupon restricted to the RETAIL range; each subscriber gets
// their own single-use promotion code attached to it. Club kit shares Stripe
// products with nothing in this list, so club items are never discounted —
// even in a mixed cart, Stripe only discounts these products.
//
// IMPORTANT: Stripe coupons are immutable. If the retail range changes (new
// drop, socks go live), bump the version suffix so a fresh coupon is created
// with the new product list. Codes already issued keep the old scope.
const COUPON_ID = 'subscriber-welcome-10-v1';
const RETAIL_HANDLES = [
  // Mirrors SUMMER_2026_HANDLES in the frontend's lib/api.ts (the live shop).
  'sunset-jersey',
  'ocean-blue-jersey',
  'red-sky-jersey',
  'black-bib-shorts',
  'granite-bib-shorts',
  'white-bib-shorts',
];
const CODE_EXPIRY_DAYS = 30;

// No ambiguous characters (0/O, 1/I/L) — these codes get typed by hand.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode() {
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `PROTONLAB10${suffix}`;
}

function retailProductIds() {
  const map = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  return RETAIL_HANDLES.map((h) => map[h]?.productId).filter(Boolean);
}

// Fetch-or-create the shared coupon. Deleted-in-dashboard is treated the same
// as missing: recreate.
async function ensureCoupon() {
  try {
    const existing = await stripe.coupons.retrieve(COUPON_ID);
    if (existing && existing.valid) return COUPON_ID;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
  await stripe.coupons.create({
    id: COUPON_ID,
    percent_off: 10,
    duration: 'once',
    name: 'Welcome 10% (retail range)',
    applies_to: { products: retailProductIds() },
  });
  return COUPON_ID;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email: rawEmail, source, website } = req.body || {};

  // Honeypot filled → bot. Pretend success, do nothing.
  if (website) return res.status(200).json({ ok: true });

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const src = source === 'footer' ? 'footer' : 'popup';

  try {
    // Dedupe against the Subscribers sheet — one welcome code per address, ever.
    const existing = await getSubscriberEmails();
    if (existing.includes(email)) {
      return res.status(200).json({ ok: true, already: true });
    }

    // Unique single-use code, 30-day expiry, retail range only.
    const coupon = await ensureCoupon();
    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_DAYS * 86400000);
    await stripe.promotionCodes.create({
      coupon,
      code,
      max_redemptions: 1,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      metadata: { source: src, email },
    });

    // Add to the Resend audience — the actual mailing list; unsubscribes are
    // managed there. This account is on Resend's single-audience model, so
    // contacts are created directly (no audienceId). Uses the HTTP API rather
    // than the SDK, whose pinned version predates the new model. Failure here
    // shouldn't lose the signup — it's still in the sheet.
    try {
      const resendKey = process.env.proton_resend_key || process.env.Resend_Backend_Key;
      const contactRes = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      if (!contactRes.ok) {
        console.error('Resend contact add failed (continuing):', await contactRes.text());
      }
    } catch (err) {
      console.error('Resend contact add failed (continuing):', err);
    }

    await appendSubscriber({
      email,
      code,
      date: new Date().toISOString(),
      source: src,
    });

    const sent = await sendWelcome(email, { code, expiresAt: expiresAt.toISOString() });
    if (!sent.ok) {
      // Code exists but the email failed — surface it so the visitor can retry
      // support instead of silently never receiving their code.
      console.error('Welcome email failed for', email, sent.error);
      return res.status(500).json({ error: 'Signup saved but the email failed to send — contact info@protonlab.cc for your code.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
