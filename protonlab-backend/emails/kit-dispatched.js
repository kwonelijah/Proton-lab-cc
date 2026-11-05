// emails/kit-dispatched.js
// Custom-kit dispatch note — sent from the dashboard when a pipeline order's
// parcel (a club's kit, usually paid by invoice) is handed to Evri with
// "Ship via web shop" ticked. Deliberately minimal next to the retail order
// emails: no order reference, no prices and no order value anywhere, and the
// send path schedules no thank-you or review follow-ups (the club is invoiced,
// not reviewed).
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
  const club = order.club && order.club !== 'N/A' ? String(order.club).trim() : '';
  const what = club ? `The ${club} kit` : 'Your kit';
  const openingHtml = trackingUrl
    ? `${what} has left us and is on its way. Standard delivery generally takes 2&ndash;4 days and you can track the parcel with Evri at the link below.`
    : `${what} has left us and is on its way. Standard delivery generally takes 2&ndash;4 days.`;
  const openingText = openingHtml.replace(/&ndash;/g, '-');

  const html = layout(`
      ${heading('Your kit is on the way')}

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

  return { subject: `Your Proton Lab kit is on the way${club ? ` — ${club}` : ''}`, html, text };
}
