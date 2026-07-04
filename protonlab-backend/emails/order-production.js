// emails/order-production.js
// "Your kit is in production" — sent to every web-shop customer of a club
// when the club's batch is moved into production on the order dashboard.

import {
  layout,
  heading,
  detailTable,
  bodyStyle,
  formatItems,
  firstName,
} from './theme.js';

export function render(order) {
  const greeting = firstName(order);
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const orderRef = order.ref || order.id;
  const items = formatItems(order);

  const html = layout(`
      ${heading('Your kit is in production')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Good news — your order${club ? ` at ${club}` : ''} is now in production.
        Made-to-order kit takes a little time to get right; we'll email you
        again the moment it ships.
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Items', value: items.html },
      ])}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Good news — your order${club ? ` at ${club}` : ''} is now in production. Made-to-order kit takes a little time to get right; we'll email you again the moment it ships.

Order: ${orderRef}
Items:
${items.text}

Questions? Reply to this email.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: `In production — ${orderRef}`,
    html,
    text,
  };
}
