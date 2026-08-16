// api/notify-me.js
// Back-in-stock request from a sold-out product page. The durable record is
// an internal email to info@ (subject carries handle + size — search it when
// stock returns); the Waitlist audience add is skipped while the Resend plan
// is at its 3-audience cap (see lib/audiences.js). Joining the mailing list
// proper is a separate opt-in the frontend sends to /api/subscribe.
//
// POST { email, handle, size, website }
//   200 { ok: true }  — recorded
//   400 { error }     — bad email or unknown product handle
//
// `website` is the same honeypot as subscribe.js: bots get a silent 200.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendWaitlistNotification } from '../lib/email.js';
import { WAITLIST_AUDIENCE_ID, addContactToAudience } from '../lib/audiences.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_PATH = path.resolve(__dirname, '..', 'data', 'stripe-products.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://protonlab.cc');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email: rawEmail, handle, size, website } = req.body || {};

  // Honeypot filled → bot. Pretend success, do nothing.
  if (website) return res.status(200).json({ ok: true });

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const products = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  if (typeof handle !== 'string' || !products[handle]) {
    return res.status(400).json({ error: 'Unknown product.' });
  }
  const sizeLabel = typeof size === 'string' ? size.slice(0, 20) : '';

  try {
    await addContactToAudience(email, WAITLIST_AUDIENCE_ID);

    // The info@ email is the actual record — if it fails, nothing was saved,
    // so surface it rather than pretending success.
    const sent = await sendWaitlistNotification({ email, handle, size: sizeLabel });
    if (!sent.ok) {
      return res.status(500).json({ error: 'Something went wrong — please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Notify-me error:', err);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
