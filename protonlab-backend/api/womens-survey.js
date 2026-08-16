// api/womens-survey.js
// Women's kit survey intake (frontend /womens page → frontend proxy route →
// here). On each submission:
//   1. Issues a unique single-use 20% code (retail range only) and emails it
//      — one code per address ever, deduped against Stripe
//   2. Stores EVERY answer as metadata on that Stripe promotion code — Stripe
//      is the private, permanent store (no Google Sheet involved)
//   3. If the respondent ticked "keep me posted", adds them to the Resend
//      "Women's line" audience
//   4. Emails the full submission to info@ (reply-to the respondent) —
//      long free-text answers live here in full (metadata caps at ~450 chars)
//
// POST { ridingTypes[], womensKit, bibLength, bibLengthCustom, strapRank[],
//        sleeve, sleevePct, frustrations, favourites, size, height, email,
//        updates, website }
// Responses mirror api/subscribe.js:
//   200 { ok: true }                — recorded, code on its way
//   200 { ok: true, already: true } — repeat submission (recorded at info@ only)
//   400 { error }                   — bad email
//
// EXPORT — download all responses as a spreadsheet-ready CSV:
//   GET /api/womens-survey?key=<proton_export_key>&format=csv
// (Same key as the /api/admin dispatch page.)
//
// `website` is a honeypot: bots fill it, humans never see it. Bot submissions
// get a silent 200 and nothing happens.

import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendWomensSurveyCode, sendWomensSurveyNotification } from '../lib/email.js';
import {
  GENERAL_AUDIENCE_ID,
  WOMENS_AUDIENCE_ID,
  addContactToAudience,
} from '../lib/audiences.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

// ─── Survey coupon ───────────────────────────────────────────────────────────
// Shared 20% coupon restricted to the RETAIL range (mirrors subscribe.js —
// club kit is never discounted). Codes have NO expiry: the women's range
// lands next year and the promise is the code works on it.
//
// LAUNCH-DAY NOTE: Stripe coupons are immutable, so codes issued today are
// scoped to the product list below. When the women's range goes live, rescope
// without changing anyone's code: for each unredeemed survey promotion code,
// set active:false, then recreate the SAME code string on a new v2 coupon
// whose applies_to includes the women's products (carry the metadata over —
// it holds the survey answers).
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

// ─── CSV export ──────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  ['Date', (pc) => new Date(pc.created * 1000).toISOString()],
  ['Email', (pc) => pc.metadata.email || ''],
  ['Riding', (pc) => pc.metadata.riding || ''],
  ["Women's kit", (pc) => pc.metadata.womens_kit || ''],
  ['Bib length', (pc) => pc.metadata.bib_length || ''],
  ['Bib custom', (pc) => pc.metadata.bib_custom || ''],
  ['Straps ranked', (pc) => pc.metadata.straps || ''],
  ['Sleeve', (pc) => pc.metadata.sleeve || ''],
  ['Sleeve %', (pc) => pc.metadata.sleeve_pct || ''],
  ['Frustrations', (pc) => pc.metadata.frustrations || ''],
  ['Favourites', (pc) => pc.metadata.favourites || ''],
  ['Size', (pc) => pc.metadata.size || ''],
  ['Height', (pc) => pc.metadata.height || ''],
  ['Updates opt-in', (pc) => pc.metadata.updates || ''],
  ['Code', (pc) => pc.code],
  ['Code used', (pc) => (pc.times_redeemed > 0 ? 'yes' : 'no')],
];

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv(res) {
  const rows = [CSV_COLUMNS.map(([name]) => csvField(name)).join(',')];
  try {
    for await (const pc of stripe.promotionCodes.list({ coupon: COUPON_ID, limit: 100 })) {
      if (!pc.metadata || pc.metadata.source !== 'womens-survey') continue;
      rows.push(CSV_COLUMNS.map(([, get]) => csvField(get(pc))).join(','));
    }
  } catch (err) {
    // Coupon doesn't exist yet — no responses; export just the header.
    if (err.statusCode !== 404) throw err;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="womens-survey.csv"');
  return res.status(200).send(rows.join('\n') + '\n');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const expected = process.env.proton_export_key;
    if (!expected) {
      return res.status(500).json({ error: 'EXPORT_KEY_MISSING: set proton_export_key in the environment' });
    }
    if (req.query.key !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      return await exportCsv(res);
    } catch (err) {
      console.error('Womens-survey export error:', err);
      return res.status(500).json({ error: 'Export failed — check the function logs.' });
    }
  }

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
    size: clean(body.size, 20),
    height: clean(body.height, 30),
    updates: body.updates ? 'yes' : 'no',
  };

  try {
    // One code per address, ever. Dedupe against Stripe itself — every issued
    // code carries the email in its metadata, so the thing being farmed is
    // also the dedupe record.
    let duplicate = false;
    try {
      for await (const pc of stripe.promotionCodes.list({ coupon: COUPON_ID, limit: 100 })) {
        if (pc.metadata && pc.metadata.email === email) {
          duplicate = true;
          break;
        }
      }
    } catch (err) {
      // Coupon doesn't exist yet (first ever submission) — no codes issued,
      // so no duplicates possible.
      duplicate = false;
    }

    let code = '';
    if (!duplicate) {
      const coupon = await ensureCoupon();
      code = generateCode();
      // The metadata on this promotion code IS the survey store. Stripe caps
      // each value at 500 chars, so the two free-text answers are truncated
      // here — the info@ copy below always carries them in full.
      await stripe.promotionCodes.create({
        coupon,
        code,
        max_redemptions: 1,
        metadata: {
          source: 'womens-survey',
          email,
          riding: answers.riding,
          womens_kit: answers.womensKit,
          bib_length: answers.bibLength,
          bib_custom: answers.bibCustom,
          straps: answers.straps,
          sleeve: answers.sleeve,
          sleeve_pct: answers.sleevePct,
          frustrations: answers.frustrations.slice(0, 450),
          favourites: answers.favourites.slice(0, 450),
          size: answers.size,
          height: answers.height,
          updates: answers.updates,
        },
      });
    }

    // "Keep me posted" → Women's line audience, plus General so a site-wide
    // newsletter reaches them without a second broadcast. Non-fatal.
    if (body.updates) {
      await addContactToAudience(email, WOMENS_AUDIENCE_ID);
      await addContactToAudience(email, GENERAL_AUDIENCE_ID);
    }

    // Internal copy to info@ — the only record that carries full-length
    // free text, and the only record of repeat submissions. Non-fatal.
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
        ['Size normally worn', answers.size],
        ['Height', answers.height],
        ['Updates opt-in', answers.updates],
        ['Code issued', duplicate ? 'no (repeat submission)' : code],
      ],
    }).catch((err) => console.error('Womens-survey notification failed:', err));

    if (duplicate) return res.status(200).json({ ok: true, already: true });

    const sent = await sendWomensSurveyCode(email, { code, inDraw: !!body.updates });
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
