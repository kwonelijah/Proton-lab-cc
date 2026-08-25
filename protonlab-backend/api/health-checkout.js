// api/health-checkout.js
// Daily synthetic checkout test (Vercel cron, see vercel.json) — creates a
// real checkout session through the same HTTP endpoint customers use, then
// immediately expires it so nothing lingers in Stripe. Emails an ops alert on
// any failure.
//
// Exists because checkout failures are otherwise invisible: when session
// creation broke in Aug 2026 the only symptom was customers bouncing off an
// error message, and it took ten days to notice. This turns "a customer would
// have failed today" into an email by 8am.
//
//   GET /api/health-checkout                 — Vercel cron (Bearer CRON_SECRET)
//   GET /api/health-checkout?key=<admin key> — manual run
//
// A failed run also triggers create-checkout-session's own customer-path
// alert — two distinctly-worded emails on a broken morning is a feature.

import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendOpsAlert } from '../lib/alerts.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization === `Bearer ${secret}`) return true;
  const key = process.env.proton_export_key;
  return Boolean(key && req.query.key === key);
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Any catalogue product works — the first map entry always exists, so the
  // check never false-alarms because one specific product was retired.
  let handle;
  try {
    handle = Object.keys(JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8')))[0];
  } catch (err) {
    await sendOpsAlert('Daily checkout health check FAILED', [
      `Could not read product map: ${err.message}`,
    ]);
    return res.status(500).json({ ok: false, error: 'product map unreadable' });
  }

  let outcome;
  try {
    const resp = await fetch(`https://${req.headers.host}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ handle, size: 'M', quantity: 1 }],
        shippingRegion: 'uk',
      }),
    });
    const data = await resp.json().catch(() => ({}));
    outcome = { status: resp.status, url: data.url, error: data.error };
  } catch (err) {
    outcome = { status: 0, error: err.message };
  }

  if (outcome.status !== 200 || !outcome.url) {
    await sendOpsAlert('Daily checkout health check FAILED', [
      `Creating a checkout session for "${handle}" did not return a URL.`,
      `HTTP ${outcome.status} — ${outcome.error || 'no error body'}`,
      'Customers likely cannot pay right now. Check Vercel logs for',
      'create-checkout-session and Stripe Workbench → Logs.',
    ]);
    return res.status(500).json({ ok: false, ...outcome });
  }

  // Session created — checkout works. Expire it so it never shows up as an
  // abandoned checkout in Stripe. An expire failure is not a checkout failure.
  let expired = false;
  const id = outcome.url.match(/cs_(?:live|test)_[A-Za-z0-9]+/)?.[0];
  if (id) {
    try {
      await stripe.checkout.sessions.expire(id);
      expired = true;
    } catch (err) {
      console.warn('Health check session expire failed (harmless):', err.message);
    }
  }

  console.log(`✓ Checkout health check passed (${handle}, session ${id || '?'}, expired: ${expired})`);
  return res.status(200).json({ ok: true, handle, sessionExpired: expired });
}
