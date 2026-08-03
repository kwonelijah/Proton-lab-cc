// emails/order-dispatched.js
// Dispatch notification — sent when a parcel is handed to Evri.
// Expects `dispatch`: { trackingNumber?, trackingUrl? }. Both optional so the
// email still reads correctly if a tracking ref isn't available yet.

import {
  layout,
  heading,
  detailTable,
  button,
  bodyStyle,
  formatShipping,
  formatItems,
  firstName,
} from './theme.js';

export function render(order, dispatch = {}) {
  const greeting = firstName(order);
  const orderRef = order.ref || order.id;
  const shipping = formatShipping(order.shipping);
  const items = formatItems(order);
  const { trackingNumber, trackingUrl } = dispatch;

  // Delivery estimate depends on the service booked — international is 5–10
  // working days, next-day is 1, standard 2–4 (config/shipping.js).
  const isInternational = order.shippingMethod === 'international';
  const estimateHtml = isInternational
    ? 'European delivery usually takes 5&ndash;10 working days.'
    : order.shippingMethod === 'next-day'
      ? 'Next-day delivery usually arrives the next working day.'
      : 'Standard delivery usually takes 2&ndash;4 working days.';
  const estimateText = estimateHtml.replace(/&ndash;/g, '-');

  const customsNote = isInternational
    ? 'Please note: customs charges and import duties are not covered by Proton Lab — your order may incur local VAT or duties on arrival.'
    : null;

  const html = layout(`
      ${heading('Your kit is on its way')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Your order has been dispatched with Evri. ${estimateHtml}
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Items', value: items.html },
        trackingNumber && { label: 'Tracking', value: trackingNumber },
        shipping && { label: 'Delivery Address', value: shipping.html },
      ])}

      ${trackingUrl ? button('Track Your Delivery', trackingUrl, 'right') : ''}

      ${customsNote ? `<p style="${bodyStyle}margin:0 0 32px 0;">${customsNote}</p>` : ''}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Your order has been dispatched with Evri. ${estimateText}

Order: ${orderRef}
Items:
${items.text}
${trackingNumber ? `Tracking: ${trackingNumber}\n` : ''}${trackingUrl ? `Track your delivery: ${trackingUrl}\n` : ''}${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}${customsNote ? `\n${customsNote}\n` : ''}
Questions? Reply to this email.

— Proton Lab CC`;

  return {
    subject: `Dispatched — ${orderRef}`,
    html,
    text,
  };
}
