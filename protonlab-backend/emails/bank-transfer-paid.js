// emails/bank-transfer-paid.js
// "Payment received" — sent by api/admin.js {action:'mark-paid'} when Elijah
// ticks a bank-transfer order as paid on the dashboard. From here the order is
// confirmed exactly like a Stripe one (production → dispatch emails follow).

import {
  layout,
  heading,
  detailTable,
  bodyStyle,
  formatItems,
  firstName,
  formatDate,
  currencySymbol,
} from './theme.js';
import { nextStepLine } from './bank-transfer-received.js';

export function render(order) {
  const greeting = firstName(order);
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const orderRef = order.ref || order.id;
  const sym = currencySymbol(order.currency);
  const total = `${sym}${parseFloat(order.amount).toFixed(2)}`;
  const items = formatItems(order);
  const paidOn = order.paidAt ? formatDate(order.paidAt) : formatDate(new Date().toISOString());

  const html = layout(`
      ${heading('Payment received')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        We've received your bank transfer of <strong>${total}</strong> for order ${orderRef}
        — thank you. Your order is confirmed and will go into ${club ? `the ${club}` : 'the club'}
        production run once the order window closes. ${nextStepLine(order, club)}
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Payment reference', value: order.payRef || '—' },
        { label: 'Items', value: items.html },
        { label: 'Paid', value: `${total} · ${paidOn}`, bold: true },
      ])}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

We've received your bank transfer of ${total} for order ${orderRef} — thank you. Your order is confirmed and will go into ${club ? `the ${club}` : 'the club'} production run once the order window closes. ${nextStepLine(order, club)}

Order: ${orderRef}
Payment reference: ${order.payRef || '—'}
Items:
${items.text}
Paid: ${total} · ${paidOn}

Questions? Reply to this email.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: `Payment received${club ? ` — ${club}` : ''} — ${orderRef}`,
    html,
    text,
  };
}
