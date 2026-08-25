// lib/ga4-mp.js
// GA4 Measurement Protocol — sends server-side events to the Proton Lab GA4
// property; the Google counterpart to lib/meta-capi.js. Used by api/webhook.js
// to report Purchases that land even when the customer never returns to
// /success or blocks gtag.js in the browser.
//
// Deduplication: GA4 ignores a purchase whose transaction_id it has already
// recorded for the same user, so this event must carry the same transaction_id
// (the Stripe Checkout Session id) AND the same client_id (the buyer's _ga
// cookie, captured at checkout-session creation) as the browser event fired by
// app/success/PurchaseTracker.tsx on the frontend. When no cookie was captured
// a random client_id is used — the purchase still records, but can only pair
// with a browser event that (in that case) almost certainly never fired.
//
// Env vars (Vercel dashboard):
//   GA4_MEASUREMENT_ID — web data stream Measurement ID (G-…), same value the
//                        frontend loads gtag.js with
//   GA4_API_SECRET     — GA4 Admin → Data streams → <stream> →
//                        Measurement Protocol API secrets → Create

import crypto from 'node:crypto';

const ENDPOINT = 'https://www.google-analytics.com/mp/collect';

// Random client id in the _ga cookie's "<random>.<epoch-seconds>" shape, for
// orders created before the frontend captured the cookie (or where a consent
// tool suppressed it).
function fallbackClientId() {
  return `${crypto.randomInt(1_000_000_000)}.${Math.floor(Date.now() / 1000)}`;
}

// Sends a single purchase event. Never throws — a failed analytics call must
// not break order processing — but logs loudly so it shows up in Vercel
// function logs. Note the MP endpoint returns 2xx even for payloads it
// discards, so a "sent" log is not proof of ingestion; use the debug endpoint
// or GA4 DebugView to verify changes to the payload shape.
export async function sendGa4Purchase({ transactionId, clientId, sessionId, value, currency, items, eventTime }) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    console.warn('GA4 MP not configured (GA4_MEASUREMENT_ID / GA4_API_SECRET) — skipping purchase');
    return null;
  }

  const params = {
    transaction_id: transactionId,
    value,
    currency,
    items,
    // Marks the hit as engaged — without this GA4 drops the event from
    // session-scoped and realtime reports.
    engagement_time_msec: 1,
  };
  // Stitch onto the browser session captured at checkout creation, where known.
  if (sessionId) params.session_id = sessionId;

  const body = {
    client_id: clientId || fallbackClientId(),
    events: [{ name: 'purchase', params }],
  };
  // Report the event at payment time (unix seconds), not webhook-delivery time.
  if (eventTime) body.timestamp_micros = Math.floor(eventTime * 1_000_000);

  const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`GA4 MP purchase failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
      return null;
    }
    console.log(`✓ GA4 MP purchase sent (transaction ${transactionId})`);
    return true;
  } catch (err) {
    console.error('GA4 MP purchase failed:', err.message);
    return null;
  }
}
