// api/womens-survey.js
// Women's kit survey intake (frontend /womens page → frontend proxy route →
// here). On each submission:
//   1. Appends every answer to the WomensSurvey sheet tab (tab + header row
//      are created automatically on first use)
//   2. Issues a unique single-use 20% code (retail range only) and emails it
//      — one code per address ever, deduped against the sheet
//   3. If the respondent ticked "keep me posted", adds them to the Resend
//      "Women's line" audience
//   4. Emails the full submission to info@ (reply-to the respondent)
//
// POST { ridingTypes[], womensKit, bibLength, bibLengthCustom, strapRank[],
//        sleeve, sleevePct, frustrations, favourites, email, updates, website }
// Responses mirror api/subscribe.js:
//   200 { ok: true }                — recorded, code on its way
//   200 { ok: true, already: true } — repeat submission (recorded, no new code)
//   400 { error }                   — bad email
//
// `website` is a honeypot: bots fill it, humans never see it. Bot submissions
// get a silent 200 and nothing happens.

import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendWomensSurveyRow, womensSurveyEmails } from '../lib/sheets.js';
import { sendWomensSurveyCode, sendWomensSurveyNotification } from '../lib/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

// Resend "Women's line" audience — respondents who ticked "keep me posted".
// Not a secret, just an ID (Resend dashboard → Audiences).
const WOMENS_AUDIENCE_ID = '838e4c6e-4f2d-45e7-8569-8a225ca4dc3f';

// ─── Survey coupon ───────────────────────────────────────────────────────────
// Shared 20% coupon restricted to the RETAIL range (mirrors subscribe.js —
// club kit is never discounted). Codes have NO expiry: the women's range
// lands next year and the promise is the code works on it.
//
// LAUNCH-DAY NOTE: Stripe coupons are immutable, so codes issued today are
// scoped to the product list below. When the women's range goes live, rescope
// without changing anyone's code: for each unredeemed survey promotion code,
// set active:false, then recreate the SAME code string on a new v2 coupon
// whose applies_to includes the women's products. Every issued code + email
// is in Stripe metadata (source: womens-survey) and on the sheet.
const COUPON_ID = 'womens-survey-20-v1';
const RETAIL_HANDLES = [
  // Mirrors SUMMER_2026_HANDLES in the frontend's lib/api.ts (the live shop).
  'sunset-jersey',
  'ocean-blue-jersey',
  'red-sky-jersey',
  'black-bib-shorts',
  'granite-bib-shorts',
  'white-bib-shorts',
];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode() {
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `PROTONLAB20${suffix}`;
}

function retailProductIds() {
  const map = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  return RETAIL_HANDLES.map((h) => map[h]?.productId).filter(Boolean);
}

async function ensureCoupon() {
  try {
    const existing = await stripe.coupons.retrieve(COUPON_ID);
    if (existing && existing.valid) return COUPON_ID;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
  await stripe.coupons.create({
    id: COUPON_ID,
    percent_off: 20,
    duration: 'once',
    name: "Women's survey 20% (retail range)",
    applies_to: { products: retailProductIds() },
  });
  return COUPON_ID;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const cleanList = (v, max = 12) =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => clean(x, 60));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // Honeypot filled → bot. Pretend success, record nothing.
  if (body.website) return res.status(200).json({ ok: true });

  const email = clean(body.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const answers = {
    riding: cleanList(body.ridingTypes).join(', '),
    womensKit: clean(body.womensKit, 60),
    bibLength: clean(body.bibLength, 60),
    bibCustom: clean(body.bibLengthCustom, 300),
    straps: cleanList(body.strapRank).join(' > '),
    sleeve: clean(body.sleeve, 60),
    sleevePct: clean(body.sleevePct, 10),
    frustrations: clean(body.frustrations),
    favourites: clean(body.favourites),
    updates: body.updates ? 'yes' : 'no',
  };

  try {
    // One code per address, ever — the sheet is the submission log.
    let duplicate = false;
    try {
      duplicate = (await womensSurveyEmails()).includes(email);
    } catch (err) {
      // If the dedupe read fails, fail open (still record) but skip the code
      // rather than risk handing out unlimited codes.
      console.error('Womens-survey dedupe read failed:', err);
      duplicate = true;
    }

    let code = '';
    if (!duplicate) {
      const coupon = await ensureCoupon();
      code = generateCode();
      await stripe.promotionCodes.create({
        coupon,
        code,
        max_redemptions: 1,
        metadata: { source: 'womens-survey', email },
      });
    }

    await appendWomensSurveyRow([
      new Date().toISOString(),
      email,
      answers.riding,
      answers.womensKit,
      answers.bibLength,
      answers.bibCustom,
      answers.straps,
      answers.sleeve,
      answers.sleevePct,
      answers.frustrations,
      answers.favourites,
      answers.updates,
      duplicate ? 'DUPLICATE — no new code' : code,
    ]);

    // "Keep me posted" → Women's line audience. Non-fatal.
    if (body.updates) {
      try {
        const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
        const contactRes = await fetch(
          `https://api.resend.com/audiences/${WOMENS_AUDIENCE_ID}/contacts`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, unsubscribed: false }),
          }
        );
        if (!contactRes.ok) {
          console.warn('Womens-line audience add failed (continuing):', await contactRes.text());
        }
      } catch (err) {
        console.error('Womens-line audience add failed (continuing):', err);
      }
    }

    // Internal copy to info@. Non-fatal.
    sendWomensSurveyNotification({
      email,
      duplicate,
      fields: [
        ['Email', email],
        ['Riding', answers.riding],
        ["Women's kit in wardrobe", answers.womensKit],
        ['Bib length', answers.bibLength],
        ['Bib length (their words)', answers.bibCustom],
        ['Straps ranked', answers.straps],
        ['Sleeve', `${answers.sleeve}${answers.sleevePct !== '' ? ` (${answers.sleevePct}%)` : ''}`],
        ['Frustrations', answers.frustrations],
        ['Favourites', answers.favourites],
        ['Updates opt-in', answers.updates],
        ['Code issued', duplicate ? 'no (repeat submission)' : code],
      ],
    }).catch((err) => console.error('Womens-survey notification failed:', err));

    if (duplicate) return res.status(200).json({ ok: true, already: true });

    const sent = await sendWomensSurveyCode(email, { code });
    if (!sent.ok) {
      console.error('Womens-survey code email failed for', email, sent.error);
      return res.status(500).json({
        error: 'Your answers were saved but the code email failed — contact info@protonlab.cc for your code.',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Womens-survey error:', err);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
