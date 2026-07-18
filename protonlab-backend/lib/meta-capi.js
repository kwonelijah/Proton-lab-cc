// lib/meta-capi.js
// Meta Conversions API — sends server-side events to the Proton Lab pixel.
// Used by api/webhook.js to report Purchases with hashed customer data plus
// the browser attribution signals (_fbp/_fbc, IP, user-agent) captured at
// checkout-session creation. event_id must match the browser pixel's eventID
// (the Stripe session id) so Meta deduplicates the browser/server pair.
//
// Env vars (Vercel dashboard):
//   META_PIXEL_ID          — pixel/dataset id from Meta Events Manager
//   META_CAPI_ACCESS_TOKEN — Conversions API token (Events Manager → Settings)
//   META_TEST_EVENT_CODE   — optional; routes events to Test Events while set

import crypto from 'node:crypto';

const API_VERSION = 'v21.0';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Builds the CAPI user_data block. All PII is normalised then SHA-256 hashed
// per Meta's spec; fbp/fbc/IP/UA are sent as-is (never hashed).
export function buildUserData({ email, phone, name, address, fbp, fbc, clientIp, clientUa }) {
  const ud = {};

  if (email && email !== 'N/A') {
    ud.em = [sha256(email.trim().toLowerCase())];
  }
  if (phone && phone !== 'N/A') {
    const digits = phone.replace(/\D/g, '');
    if (digits) ud.ph = [sha256(digits)];
  }
  if (name && name !== 'N/A') {
    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts[0]) ud.fn = [sha256(parts[0])];
    if (parts.length > 1) ud.ln = [sha256(parts[parts.length - 1])];
  }
  if (address) {
    if (address.city) ud.ct = [sha256(address.city.trim().toLowerCase().replace(/\s/g, ''))];
    if (address.state) ud.st = [sha256(address.state.trim().toLowerCase().replace(/\s/g, ''))];
    if (address.postal_code) ud.zp = [sha256(address.postal_code.trim().toLowerCase().replace(/\s/g, ''))];
    if (address.country) ud.country = [sha256(address.country.trim().toLowerCase())];
  }

  if (fbp) ud.fbp = fbp;
  if (fbc) ud.fbc = fbc;
  if (clientIp) ud.client_ip_address = clientIp;
  if (clientUa) ud.client_user_agent = clientUa;

  return ud;
}

// Sends a single event. Never throws on configuration/API problems — a failed
// ad event must not break order processing — but logs loudly so it shows up
// in Vercel function logs.
export async function sendMetaEvent({ eventName, eventId, eventTime, eventSourceUrl, userData, customData }) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    console.warn(`Meta CAPI not configured (META_PIXEL_ID / META_CAPI_ACCESS_TOKEN) — skipping ${eventName}`);
    return null;
  }

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime ?? Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      console.error(`Meta CAPI ${eventName} rejected:`, JSON.stringify(json));
      return null;
    }
    console.log(`✓ Meta CAPI ${eventName} sent (event_id: ${eventId})`);
    return json;
  } catch (err) {
    console.error(`Meta CAPI ${eventName} failed:`, err.message);
    return null;
  }
}
