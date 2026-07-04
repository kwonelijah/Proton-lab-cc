// emails/order-confirmation.js
// Customer order confirmation — sent from the Stripe webhook on payment.

import {
  layout,
  heading,
  detailTable,
  bodyStyle,
  formatShipping,
  formatItems,
  firstName,
  formatDate,
} from './theme.js';

export function render(order) {
  const greeting = firstName(order);
  const products = order.product || 'your order';
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const orderRef = order.ref || order.id;
  const total = `£${parseFloat(order.amount).toFixed(2)}`;
  const shipping = formatShipping(order.shipping);
  const items = formatItems(order);
  const date = formatDate(order.date);

  // Delivery + discount lines. Older orders (pre-shipping) won't have these fields.
  const shippingCost = parseFloat(order.shippingAmount || '0');
  const delivery = order.shippingLabel
    ? `${order.shippingLabel} — ${shippingCost > 0 ? `£${shippingCost.toFixed(2)}` : 'Free'}`
    : null;
  const discountValue = parseFloat(order.discountAmount || '0');
  const discount = discountValue > 0
    ? `−£${discountValue.toFixed(2)}${order.promoCode ? ` (${order.promoCode})` : ''}`
    : null;

  const html = layout(`
      ${heading('Your order is confirmed')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Thank you for your order at ${club || 'Proton Lab'}.
        Your order is confirmed and we'll be in touch once it's shipped.
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Items', value: items.html },
        delivery && { label: 'Delivery', value: delivery },
        discount && { label: 'Discount', value: discount },
        { label: 'Total', value: total, bold: true },
        shipping && { label: 'Delivery Address', value: shipping.html },
        { label: 'Date', value: date },
      ])}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Thank you for your order at ${club || 'Proton Lab'}. Your order is confirmed and we'll be in touch once it's shipped.

Order: ${orderRef}
Items:
${items.text}
${delivery ? `Delivery: ${delivery}\n` : ''}${discount ? `Discount: ${discount}\n` : ''}Total: ${total}
${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}Date: ${date}

Questions? Reply to this email.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: `Order confirmed${club ? ` — ${club}` : ''} — ${products}`,
    html,
    text,
  };
}
