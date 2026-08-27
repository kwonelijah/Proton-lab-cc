// api/subscribe.js
// Newsletter signup: adds the address to the General audience in Resend,
// issues a unique single-use 10% welcome code (retail range only), and emails
// the code. The code is only ever delivered by email — that's what proves the
// address is real. The subscriber log lives in Resend (Audiences → General);
// each issued code is also visible in Stripe (promotion code metadata carries
// the email + source).
//
// POST { email, source, riding } — source is 'popup' | 'footer' | 'contact' |
// 'notify', recorded on the Stripe promo code so signups can be traced to
// their surface. `riding` is the popup poll's answer — an array of keys from
// RIDING_AUDIENCE_IDS (a bare string is also accepted, for older cached
// bundles): recorded on the promo code and used to add the contact to each
// matching riding-type audience alongside General.
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
import { sendWelcome } from '../lib/email.js';
import {
  GENERAL_AUDIENCE_ID,
  RIDING_AUDIENCE_IDS,
  addContactToAudience,
  contactInAudience,
} from '../lib/audiences.js';

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

  const { email: rawEmail, source, riding, ridingOther, website } = req.body || {};

  // Honeypot filled → bot. Pretend success, do nothing.
  if (website) return res.status(200).json({ ok: true });

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const src = ['footer', 'contact', 'notify'].includes(source) ? source : 'popup';
  const rides = [...new Set(
    (Array.isArray(riding) ? riding : [riding]).filter(
      (r) => typeof r === 'string' && RIDING_AUDIENCE_IDS[r]
    )
  )];
  // Free text typed under the "Other" option — recorded on the promo code
  // only; the contact still lands in the Other audience like any bucket.
  const rideOther =
    rides.includes('other') && typeof ridingOther === 'string'
      ? ridingOther.trim().slice(0, 80)
      : '';

  try {
    // Dedupe against the General audience — one welcome code per address,
    // ever. General holds everyone marketable (including consenting
    // purchasers), so a customer who later uses the popup gets `already`
    // rather than a second code. Codes are additionally logged on each
    // Stripe promotion code's metadata.
    if (await contactInAudience(email, GENERAL_AUDIENCE_ID)) {
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
      metadata: {
        source: src,
        email,
        ...(rides.length && { riding: rides.join(', ') }),
        ...(rideOther && { riding_other: rideOther }),
      },
    });

    // Add to the General audience — the actual mailing list; unsubscribes
    // are managed in Resend — plus every riding-type bucket ticked in the
    // popup's poll. Sequential to respect Resend's ~2 req/s limit; failures
    // are logged inside the helper and never block the welcome code.
    await addContactToAudience(email, GENERAL_AUDIENCE_ID);
    for (const r of rides) {
      await addContactToAudience(email, RIDING_AUDIENCE_IDS[r]);
    }

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
