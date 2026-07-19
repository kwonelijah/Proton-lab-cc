// lib/email.js
// Sends order emails to the customer and internal notifications to the team.
// Customer-facing designs live in ../emails/ and render through the shared
// brand theme (emails/theme.js) — do not inline ad-hoc styles here.

import { Resend } from 'resend';
import { COLORS, FONTS, formatShipping, formatItems } from '../emails/theme.js';
import { render as renderConfirmation } from '../emails/order-confirmation.js';
import { render as renderProduction } from '../emails/order-production.js';
import { render as renderDispatched } from '../emails/order-dispatched.js';
import { render as renderDelivered } from '../emails/order-delivered.js';
import { render as renderWelcome } from '../emails/welcome.js';

const FROM = 'Proton Lab CC <noreply@protonlab.cc>';
const TEAM = 'info@protonlab.cc';

// Construct the Resend client lazily. Doing it at module scope means a missing
// API key throws on import and crashes the whole function (webhook included)
// before any error handling runs — this surfaces it as a handled error instead.
let _resend = null;
function getResend() {
  const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
  if (!key) throw new Error('RESEND_KEY_MISSING: proton_resend_key is not set in the environment');
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

// Shared send wrapper: skips when the order has no usable customer email,
// normalises Resend errors into { ok, error } results.
async function sendToCustomer(order, { subject, html, text }, options = {}) {
  if (!order.email || order.email === 'N/A') {
    console.warn('No customer email — skipping send:', subject);
    return { ok: false, skipped: 'no-customer-email' };
  }

  let error;
  try {
    ({ error } = await getResend().emails.send({
      from: FROM,
      to: order.email,
      replyTo: TEAM,
      subject,
      html,
      text,
      ...options, // e.g. scheduledAt for the delivered thank-you
    }));
  } catch (e) {
    error = e;
  }

  if (error) {
    console.error(`Failed to send "${subject}" to ${order.email}:`, error);
    return { ok: false, error: error.message || String(error) };
  }
  console.log(`Sent "${subject}" to ${order.email}`);
  return { ok: true };
}

// ─── Customer emails ─────────────────────────────────────────────────────────

export async function sendOrderConfirmation(order) {
  return sendToCustomer(order, renderConfirmation(order));
}

export async function sendOrderInProduction(order) {
  return sendToCustomer(order, renderProduction(order));
}

// dispatch: { trackingNumber?, trackingUrl? }
export async function sendOrderDispatched(order, dispatch = {}) {
  return sendToCustomer(order, renderDispatched(order, dispatch));
}

// options.scheduledAt (ISO string) lets the dispatch flow schedule this for a
// few days after handover — Resend supports scheduling up to 30 days ahead.
export async function sendOrderDelivered(order, options = {}) {
  return sendToCustomer(order, renderDelivered(order), options);
}

// Newsletter welcome with the subscriber's unique 10% code.
export async function sendWelcome(email, { code, expiresAt }) {
  return sendToCustomer({ email }, renderWelcome({ code, expiresAt }));
}

// Adds a customer to the Resend contact list (single-audience model — no
// audienceId). Called by the webhook on every paid order so buyers land on
// the mailing list automatically; no email is sent and no welcome code is
// issued. Existing contacts and failures are non-fatal — never let this
// break order processing.
export async function addToMailingList(order) {
  if (!order.email || order.email === 'N/A') return { ok: false, skipped: 'no-customer-email' };
  const name = order.name && order.name !== 'N/A' ? order.name : '';
  const [firstName, ...rest] = name.split(' ').filter(Boolean);
  try {
    const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: order.email.toLowerCase(),
        firstName: firstName || undefined,
        lastName: rest.join(' ') || undefined,
        unsubscribed: false,
      }),
    });
    if (!res.ok) {
      console.warn(`Mailing-list add skipped for ${order.email}:`, await res.text());
      return { ok: false };
    }
    console.log(`Added ${order.email} to mailing list`);
    return { ok: true };
  } catch (err) {
    console.error('Mailing-list add failed (continuing):', err);
    return { ok: false };
  }
}

// ─── Internal team notification ─────────────────────────────────────────────

export async function sendInternalNotification(order) {
  const total = `£${parseFloat(order.amount).toFixed(2)}`;
  const club = order.club && order.club !== 'N/A' ? order.club : '—';
  const orderRef = order.ref || order.id;
  const shipping = formatShipping(order.shipping);
  const itemsFmt = formatItems(order);

  // Delivery service line — this is what tells us which Evri service to book.
  const serviceNames = { standard: 'Standard', 'next-day': 'NEXT-DAY', international: 'International' };
  const shippingCost = parseFloat(order.shippingAmount || '0');
  const service = serviceNames[order.shippingMethod] || 'Standard';
  const deliveryLine = `${service} (${order.shippingLabel || 'Standard Delivery'}) — ${shippingCost > 0 ? `£${shippingCost.toFixed(2)}` : 'Free'}`;
  const discountValue = parseFloat(order.discountAmount || '0');
  const discountLine = discountValue > 0
    ? `−£${discountValue.toFixed(2)}${order.promoCode ? ` (code: ${order.promoCode})` : ''}`
    : null;

  const label = `padding:10px 0;border-bottom:1px solid ${COLORS.light};font-family:${FONTS.body};font-size:13px;color:${COLORS.grey};`;
  const value = `padding:10px 0;border-bottom:1px solid ${COLORS.light};font-family:${FONTS.body};font-size:13px;color:${COLORS.black};`;

  const html = `
    <div style="font-family:${FONTS.body};max-width:600px;margin:0 auto;color:${COLORS.black};">
      <h2 style="font-size:16px;margin-bottom:24px;">New Order</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="${label}width:100px;">Order</td>
          <td style="${value}font-weight:bold;">${orderRef}</td>
        </tr>
        <tr>
          <td style="${label}">Club</td>
          <td style="${value}">${club}</td>
        </tr>
        <tr>
          <td style="${label}">Customer</td>
          <td style="${value}">${order.name}</td>
        </tr>
        <tr>
          <td style="${label}">Email</td>
          <td style="${value}"><a href="mailto:${order.email}" style="color:${COLORS.black};">${order.email}</a></td>
        </tr>
        <tr>
          <td style="${label}">Phone</td>
          <td style="${value}"><a href="tel:${order.phone}" style="color:${COLORS.black};">${order.phone}</a></td>
        </tr>
        <tr>
          <td style="${label}vertical-align:top;">Items</td>
          <td style="${value}line-height:1.6;">${itemsFmt.html}</td>
        </tr>
        <tr>
          <td style="${label}vertical-align:top;">Deliver to</td>
          <td style="${value}line-height:1.6;">${shipping ? shipping.html : 'No address collected'}</td>
        </tr>
        <tr>
          <td style="${label}">Delivery service</td>
          <td style="${value}${order.shippingMethod === 'next-day' ? 'font-weight:bold;' : ''}">${deliveryLine}</td>
        </tr>
        ${discountLine ? `
        <tr>
          <td style="${label}">Discount</td>
          <td style="${value}">${discountLine}</td>
        </tr>` : ''}
        <tr>
          <td style="${label}">Stripe ref</td>
          <td style="${value}font-size:12px;color:${COLORS.grey};">${order.id}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-family:${FONTS.body};font-size:13px;color:${COLORS.grey};">Total</td>
          <td style="padding:10px 0;font-family:${FONTS.body};font-size:13px;font-weight:bold;">${total}</td>
        </tr>
      </table>
    </div>
  `;

  let error;
  try {
    ({ error } = await getResend().emails.send({
      from: FROM,
      to: TEAM,
      subject: `New order: ${orderRef} — ${order.name}`,
      html,
      text: `New order\n\nOrder: ${orderRef}\nClub: ${club}\nCustomer: ${order.name} (${order.email})\nPhone: ${order.phone}\nItems:\n${itemsFmt.text}\nDeliver to:\n${shipping ? shipping.text : 'No address collected'}\nDelivery service: ${deliveryLine}\n${discountLine ? `Discount: ${discountLine}\n` : ''}Total: ${total}\nStripe ref: ${order.id}`,
    }));
  } catch (e) {
    error = e;
  }

  if (error) {
    console.error('Failed to send internal notification:', error);
    return { ok: false, error: error.message || String(error) };
  }
  console.log(`Internal notification sent for order ${order.id}`);
  return { ok: true };
}
