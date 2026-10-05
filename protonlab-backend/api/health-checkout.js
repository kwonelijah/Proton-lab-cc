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
import { loadProductMap } from '../lib/order-items.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Second probe: a big basket. Checkout used to fail above ~7 distinct lines
// (Stripe's 500-char metadata cap) and nobody knew until a customer hit it;
// this keeps that class of regression visible. 12 lines is well past the old
// failure point and well under Stripe's 100-line-item ceiling.
const LARGE_BASKET_LINES = 12;
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

function largeBasketItems() {
  const handles = Object.keys(loadProductMap());
  const picked = handles.slice(0, LARGE_BASKET_LINES);
  return picked.map((handle, i) => ({ handle, size: SIZES[i % SIZES.length], quantity: 1 }));
}

async function probe(host, items) {
  try {
    const resp = await fetch(`https://${host}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, shippingRegion: 'uk' }),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, url: data.url, error: data.error };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

// Expire a created session so it never shows as an abandoned checkout.
// An expire failure is not a checkout failure.
async function expireSession(url) {
  const id = url?.match(/cs_(?:live|test)_[A-Za-z0-9]+/)?.[0];
  if (!id) return { id: null, expired: false };
  try {
    await stripe.checkout.sessions.expire(id);
    return { id, expired: true };
  } catch (err) {
    console.warn('Health check session expire failed (harmless):', err.message);
    return { id, expired: false };
  }
}

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

  // Probe 1: a product customers can actually buy right now.
  const handle = await liveHandle();
  const single = await probe(req.headers.host, [{ handle, size: 'M', quantity: 1 }]);

  if (single.status !== 200 || !single.url) {
    await sendOpsAlert('Checkout health check FAILED', [
      `Creating a checkout session for "${handle}" did not return a URL.`,
      `HTTP ${single.status} — ${single.error || 'no error body'}`,
      'Customers likely cannot pay right now. Check Vercel logs for',
      'create-checkout-session and Stripe Workbench → Logs.',
    ]);
    return res.status(500).json({ ok: false, probe: 'single', ...single });
  }
  const singleExpire = await expireSession(single.url);

  // Probe 2: a large basket (many distinct lines) — guards the metadata encoding.
  const largeItems = largeBasketItems();
  const large = await probe(req.headers.host, largeItems);
  if (large.status !== 200 || !large.url) {
    await sendOpsAlert('Checkout health check FAILED for a large basket', [
      `A ${largeItems.length}-line basket did not return a checkout URL (a single item did).`,
      `HTTP ${large.status} — ${large.error || 'no error body'}`,
      'Customers with big baskets cannot pay. Suspect the line-item metadata',
      'encoding (protonlab-backend/lib/order-items.js) or a Stripe limit change.',
    ]);
    return res.status(500).json({ ok: false, probe: 'large', lines: largeItems.length, ...large });
  }
  const largeExpire = await expireSession(large.url);

  console.log(
    `✓ Checkout health check passed (${handle}, session ${singleExpire.id || '?'} expired: ${singleExpire.expired}; ` +
    `${largeItems.length}-line basket session ${largeExpire.id || '?'} expired: ${largeExpire.expired})`
  );
  return res.status(200).json({
    ok: true,
    handle,
    sessionExpired: singleExpire.expired,
    largeBasketLines: largeItems.length,
    largeBasketSessionExpired: largeExpire.expired,
  });
}
