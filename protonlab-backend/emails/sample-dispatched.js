// emails/sample-dispatched.js
// Samples dispatch note — sent from the dashboard's Samples flow when a
// sample parcel is handed to Evri. Deliberately minimal next to the order
// emails: no order reference, no prices and no order value anywhere, and the
// send path schedules no thank-you or review follow-ups.
// Expects `dispatch`: { trackingNumber?, trackingUrl? } — both optional; the
// opening line only promises a tracking link when there is one.

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
  const shipping = formatShipping(order.shipping);
  const items = formatItems(order);
  const { trackingNumber, trackingUrl } = dispatch;
  const openingHtml = trackingUrl
    ? 'Your kit samples have just been sent out and should be with you soon. Standard delivery generally takes 2&ndash;4 days and you can track with Evri at the link below.'
    : 'Your kit samples have just been sent out and should be with you soon. Standard delivery generally takes 2&ndash;4 days.';
  const openingText = openingHtml.replace(/&ndash;/g, '-');

  const html = layout(`
      ${heading('Your samples are on the way')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        ${openingHtml}
      </p>

      ${detailTable([
        { label: 'In the parcel', value: items.html },
        trackingNumber && { label: 'Tracking', value: trackingNumber },
        shipping && { label: 'Delivery Address', value: shipping.html },
      ])}

      ${trackingUrl ? button('Track Your Delivery', trackingUrl, 'center') : ''}
`);

  const text = `Hi ${greeting},

${openingText}

In the parcel:
${items.text}
${trackingNumber ? `Tracking: ${trackingNumber}\n` : ''}${trackingUrl ? `Track your delivery: ${trackingUrl}\n` : ''}${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}
— Proton Lab CC`;

  return { subject: 'Your Proton Lab samples are on the way', html, text };
}
