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

  const html = layout(`
      ${heading('Your kit is on its way')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Your order has been dispatched with Evri. Standard delivery usually
        takes 2&ndash;4 working days.
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Items', value: items.html },
        trackingNumber && { label: 'Tracking', value: trackingNumber },
        shipping && { label: 'Delivery Address', value: shipping.html },
      ])}

      ${trackingUrl ? button('Track Your Delivery', trackingUrl, 'center') : ''}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Your order has been dispatched with Evri. Standard delivery usually takes 2-4 working days.

Order: ${orderRef}
Items:
${items.text}
${trackingNumber ? `Tracking: ${trackingNumber}\n` : ''}${trackingUrl ? `Track your delivery: ${trackingUrl}\n` : ''}${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}
Questions? Reply to this email.

— Proton Lab CC`;

  return {
    subject: `Dispatched — ${orderRef}`,
    html,
    text,
  };
}
