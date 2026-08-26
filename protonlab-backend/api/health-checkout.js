// api/health-checkout.js
// Synthetic checkout test — creates a real checkout session through the same
// HTTP endpoint customers use, then immediately expires it so nothing lingers
// in Stripe. Emails an ops alert on any failure.
//
// Exists because checkout failures are otherwise invisible: when session
// creation broke in Aug 2026 the only symptom was customers bouncing off an
// error message, and it took ten days to notice.
//
// Polled every 6 hours by GitHub Actions (.github/workflows/checkout-health.yml
// at the repo root) — a failing run also triggers GitHub's own workflow-failure
// email, a second alert channel independent of Resend.
//
//   GET /api/health-checkout?key=<admin key> — Actions poll or manual run
//   GET /api/health-checkout                 — Bearer CRON_SECRET also accepted
//
// A failed run also triggers create-checkout-session's own customer-path
// alert — two distinctly-worded emails on a broken morning is a feature.

import Stripe from 'stripe';
import { sendOpsAlert } from '../lib/alerts.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// The Meta catalog feed on the live site lists exactly the products customers
// can currently buy (the Stripe product map also contains hidden/legacy
// products, which could pass the check while the live range is broken).
const FEED_URL = 'https://protonlab.cc/proton-lab-meta-catalog-feed.csv';
const FALLBACK_HANDLE = 'sunset-jersey'; // live Summer 2026 product

// First in-stock handle from the feed; falls back to a known live handle if
// the feed is unreachable — the session-creation call validates it anyway.
async function liveHandle() {
  try {
    const res = await fetch(FEED_URL);
    if (res.ok) {
      const lines = (await res.text()).split('\n').slice(1);
      for (const line of lines) {
        const m = line.match(/^"([a-z0-9-]+)"/);
        if (m && line.includes('"in stock"')) return m[1];
      }
    }
  } catch {
    // fall through to the fallback
  }
  return FALLBACK_HANDLE;
}

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

  // Test with a product customers can actually buy right now.
  const handle = await liveHandle();

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
    await sendOpsAlert('Checkout health check FAILED', [
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
