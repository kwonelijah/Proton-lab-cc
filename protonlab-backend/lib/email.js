// lib/email.js
// Sends order confirmation to the customer and internal notification to the team

import { Resend } from 'resend';

const resend = new Resend(process.env.Resend_Backend_Key);

// ─── Customer confirmation email ────────────────────────────────────────────

export async function sendOrderConfirmation(order) {
  if (!order.email || order.email === 'N/A') {
    console.warn('No customer email — skipping confirmation send');
    return;
  }

  const greeting = order.name && order.name !== 'N/A' ? order.name.split(' ')[0] : 'there';
  const products = order.product || 'your order';
  const total = `£${parseFloat(order.amount).toFixed(2)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;padding:40px 20px;">

      <p style="font-size:22px;font-weight:bold;margin:0 0 32px 0;letter-spacing:-0.02em;">
        Proton Lab CC
      </p>

      <p style="font-size:15px;margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 32px 0;">
        Your order is confirmed. We'll be in touch once your kit is ready to ship.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;width:120px;">Order</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.id}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Items</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${products}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Total</td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-size:13px;font-weight:bold;">${total}</td>
        </tr>
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

  const text = `Hi ${greeting},\n\nYour order is confirmed.\n\nOrder: ${order.id}\nItems: ${products}\nTotal: ${total}\nDate: ${new Date(order.date).toLocaleDateString('en-GB')}\n\nQuestions? Reply to this email.\n\n— Proton Lab CC`;

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: order.email,
    replyTo: 'info@protonlab.cc',
    subject: `Order confirmed — ${products}`,
    html,
    text,
  });

  if (error) {
    console.error('Failed to send customer confirmation:', error);
  } else {
    console.log(`Confirmation sent to ${order.email}`);
  }
}

// ─── Internal team notification ─────────────────────────────────────────────

export async function sendInternalNotification(order) {
  const total = `£${parseFloat(order.amount).toFixed(2)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      <h2 style="font-size:16px;margin-bottom:24px;">New Order</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;color:#666;width:100px;">Order ID</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${order.id}</td>
        </tr>
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
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#666;">Total</td>
          <td style="padding:10px 0;font-size:13px;font-weight:bold;">${total}</td>
        </tr>
      </table>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: 'info@protonlab.cc',
    subject: `New order: ${order.product} — ${order.name}`,
    html,
    text: `New order\n\nID: ${order.id}\nCustomer: ${order.name} (${order.email})\nItems: ${order.product}\nTotal: ${total}`,
  });

  if (error) {
    console.error('Failed to send internal notification:', error);
  } else {
    console.log(`Internal notification sent for order ${order.id}`);
  }
}
