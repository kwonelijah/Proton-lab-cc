// lib/alerts.js
// Operational alert emails to the team — plain, loud, and safe to call from
// any hot path: never throws, and repeats of the same alert are suppressed
// for an hour per warm instance so an outage sends a handful of emails, not
// one per customer attempt. (Suppression is in-memory: cold starts may let
// an extra email through — acceptable, the failure mode is mild duplication,
// never silence.)
//
// Born from the Aug 2026 checkout outage: Stripe silently started rejecting
// a session parameter and checkout 500'd for TEN DAYS before anyone noticed,
// because the only signal was customers seeing "Could not connect to payment
// server" and leaving. Errors on the money path must page a human.

import { Resend } from 'resend';

const FROM = 'Proton Lab CC <noreply@protonlab.cc>';
const TO = process.env.ALERT_EMAIL || 'info@protonlab.cc';
const SUPPRESS_MS = 60 * 60 * 1000;

const lastSent = new Map(); // subject → epoch ms

export async function sendOpsAlert(subject, lines = []) {
  try {
    const now = Date.now();
    const prev = lastSent.get(subject) || 0;
    if (now - prev < SUPPRESS_MS) {
      console.warn(`Ops alert suppressed (sent ${Math.round((now - prev) / 60000)}m ago): ${subject}`);
      return { ok: false, suppressed: true };
    }

    const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
    if (!key) {
      console.error(`Ops alert NOT sent (no Resend key): ${subject}`);
      return { ok: false, error: 'no-resend-key' };
    }

    const body = [...lines, '', `Time: ${new Date().toISOString()}`].join('\n');
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to: TO,
      subject: `⚠ ${subject}`,
      text: body,
    });
    if (error) {
      console.error(`Ops alert send failed: ${error.message || JSON.stringify(error)}`);
      return { ok: false, error };
    }
    lastSent.set(subject, now);
    console.log(`✓ Ops alert sent: ${subject}`);
    return { ok: true };
  } catch (err) {
    console.error('Ops alert send crashed:', err.message);
    return { ok: false, error: err.message };
  }
}
