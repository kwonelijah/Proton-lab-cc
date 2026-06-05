// lib/email.js
// Sends order confirmation to the customer and internal notification to the team

import { Resend } from 'resend';

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

// Formats a Stripe `shipping` object into address lines. Returns null if no
// address was collected, so callers can omit the delivery block entirely.
function formatShipping(shipping) {
  if (!shipping || !shipping.address) return null;
  const a = shipping.address;
  const lines = [
    shipping.name,
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(' '),
    a.state,
    a.country,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return { html: lines.join('<br>'), text: lines.join('\n') };
}

// ─── Customer confirmation email ────────────────────────────────────────────

export async function sendOrderConfirmation(order) {
  if (!order.email || order.email === 'N/A') {
    console.warn('No customer email — skipping confirmation send');
    return { ok: false, skipped: 'no-customer-email' };
  }

  const greeting = order.name && order.name !== 'N/A' ? order.name.split(' ')[0] : 'there';
  const products = order.product || 'your order';
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const total = `£${parseFloat(order.amount).toFixed(2)}`;
  const shipping = formatShipping(order.shipping);

  const clubRow = club ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Club</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${club}</td>
        </tr>` : '';

  const shippingRow = shipping ? `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;vertical-align:top;">Deliver to</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;line-height:1.6;">${shipping.html}</td>
        </tr>` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:40px 20px;">

      <p style="font-size:22px;font-weight:bold;margin:0 0 32px 0;letter-spacing:-0.02em;">
        Proton Lab CC
      </p>

      <p style="font-size:15px;margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 32px 0;">
        Thank you for your order${club ? ` with ${club}` : ''} — we really appreciate it.
        Your order is confirmed and we'll be in touch once your kit is ready to ship.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;width:120px;">Order</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.id}</td>
        </tr>${clubRow}
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Items</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${products}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Total</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;font-weight:bold;">${total}</td>
        </tr>${shippingRow}
        <tr>
          <td style="padding:12px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Date</td>
          <td style="padding:12px 0;font-size:13px;">${new Date(order.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
      </table>

      <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>

      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 24px 0;" />
      <p style="font-size:11px;color:#999;margin:0;">
        Proton Lab CC &nbsp;·&nbsp; <a href="https://protonlab.cc" style="color:#999;text-decoration:none;">protonlab.cc</a>
      </p>

    </div>
  `;

  const text = `Hi ${greeting},\n\nThank you for your order${club ? ` with ${club}` : ''} — we really appreciate it. Your order is confirmed.\n\nOrder: ${order.id}\n${club ? `Club: ${club}\n` : ''}Items: ${products}\nTotal: ${total}\n${shipping ? `Deliver to:\n${shipping.text}\n` : ''}Date: ${new Date(order.date).toLocaleDateString('en-GB')}\n\nQuestions? Reply to this email.\n\n— Proton Lab CC`;

  let error;
  try {
    ({ error } = await getResend().emails.send({
      from: 'Proton Lab CC <noreply@protonlab.cc>',
      to: order.email,
      replyTo: 'info@protonlab.cc',
      subject: `Order confirmed${club ? ` — ${club}` : ''} — ${products}`,
      html,
      text,
    }));
  } catch (e) {
    error = e;
  }

  if (error) {
    console.error('Failed to send customer confirmation:', error);
    return { ok: false, error: error.message || String(error) };
  }
  console.log(`Confirmation sent to ${order.email}`);
  return { ok: true };
}

// ─── Internal team notification ─────────────────────────────────────────────

export async function sendInternalNotification(order) {
  const total = `£${parseFloat(order.amount).toFixed(2)}`;
  const club = order.club && order.club !== 'N/A' ? order.club : '—';
  const shipping = formatShipping(order.shipping);

  const clubRow = `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;">Club</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${club}</td>
        </tr>`;

  const shippingRow = `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;vertical-align:top;">Deliver to</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;line-height:1.6;">${shipping ? shipping.html : 'No address collected'}</td>
        </tr>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <h2 style="font-size:16px;margin-bottom:24px;">New Order</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;width:100px;">Order ID</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.id}</td>
        </tr>${clubRow}
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;">Customer</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">
            <a href="mailto:${order.email}" style="color:#1a1a1a;">${order.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;">Items</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.product}</td>
        </tr>${shippingRow}
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#666;">Total</td>
          <td style="padding:10px 0;font-size:13px;font-weight:bold;">${total}</td>
        </tr>
      </table>
    </div>
  `;

  let error;
  try {
    ({ error } = await getResend().emails.send({
      from: 'Proton Lab CC <noreply@protonlab.cc>',
      to: 'info@protonlab.cc',
      subject: `New order: ${order.product} — ${order.name}`,
      html,
      text: `New order\n\nID: ${order.id}\nClub: ${club}\nCustomer: ${order.name} (${order.email})\nItems: ${order.product}\nDeliver to:\n${shipping ? shipping.text : 'No address collected'}\nTotal: ${total}`,
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
