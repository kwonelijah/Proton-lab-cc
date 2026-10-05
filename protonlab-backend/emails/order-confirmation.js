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
  currencySymbol,
} from './theme.js';

export function render(order) {
  const greeting = firstName(order);
  // Subject line: the first two product names, then "+N more" — a 20-line club
  // order must not produce a 500-character subject. The body lists every line.
  const names = Array.isArray(order.lineItems)
    ? [...new Set(order.lineItems.map((i) => i.name || i.handle).filter(Boolean))]
    : [];
  const products = names.length
    ? names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
    : order.product || 'your order';
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const orderRef = order.ref || order.id;
  const sym = currencySymbol(order.currency);
  const total = `${sym}${parseFloat(order.amount).toFixed(2)}`;
  const shipping = formatShipping(order.shipping);
  const items = formatItems(order);
  const date = formatDate(order.date);

  // Delivery + discount lines. Older orders (pre-shipping) won't have these fields.
  const shippingCost = parseFloat(order.shippingAmount || '0');
  const delivery = order.shippingLabel
    ? `${order.shippingLabel} — ${shippingCost > 0 ? `${sym}${shippingCost.toFixed(2)}` : 'Free'}`
    : null;
  const discountValue = parseFloat(order.discountAmount || '0');
  const discount = discountValue > 0
    ? `−${sym}${discountValue.toFixed(2)}${order.promoCode ? ` (${order.promoCode})` : ''}`
    : null;

  // International (non-UK) orders pass through customs — Proton Lab covers
  // VAT/duties, so say it plainly on the order record.
  const customsNote = order.shippingMethod === 'international'
    ? "Customs charges and import duties are covered by Proton Lab — there's nothing extra to pay on arrival."
    : null;

  // Club-delivery orders travel to the club's distributor with the rest of the
  // club's kit — no parcel to this customer, so say where it will turn up.
  const nextStep = order.shippingMethod === 'club'
    ? `Your order is confirmed. Your kit will be delivered to ${club || 'your club'} with the rest of the club's order, and the club will hand it out — there's nothing to post.`
    : "Your order is confirmed and we'll be in touch once it's shipped.";

  const html = layout(`
      ${heading('Your order is confirmed')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Thank you for your order at ${club || 'Proton Lab'}.
        ${nextStep}
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

      ${customsNote ? `<p style="${bodyStyle}margin:0 0 32px 0;">${customsNote}</p>` : ''}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Thank you for your order at ${club || 'Proton Lab'}. ${nextStep}

Order: ${orderRef}
Items:
${items.text}
${delivery ? `Delivery: ${delivery}\n` : ''}${discount ? `Discount: ${discount}\n` : ''}Total: ${total}
${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}Date: ${date}
${customsNote ? `\n${customsNote}\n` : ''}
Questions? Reply to this email.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: `Order confirmed${club ? ` — ${club}` : ''} — ${products}`,
    html,
    text,
  };
}
