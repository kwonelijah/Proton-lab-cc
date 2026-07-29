// emails/order-delivered.js
// Post-delivery thank-you — scheduled at dispatch time for a few days after,
// so the wording avoids claiming certainty about the delivery date.

import { layout, bodyStyle, firstName } from './theme.js';
import { COLORS } from './theme.js';

export function render(order) {
  const greeting = firstName(order);
  const orderRef = order.ref || order.id;

  const html = layout(`
      <p style="${bodyStyle}margin:0 0 16px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 16px 0;">
        Your order should now be with you, we hope you enjoy riding in your
        new kit!
      </p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Remember to tag
        <a href="https://www.instagram.com/protonlabcc/" style="color:${COLORS.black};">@protonlabcc</a>
        in your photos, we can't wait to see you out and about.
      </p>
      <p style="${bodyStyle}margin:0;">Thanks from us!</p>
`);

  const text = `Hi ${greeting},

Your order should now be with you, we hope you enjoy riding in your new kit!

Remember to tag @protonlabcc in your photos, we can't wait to see you out and about.

Thanks from us!

— Proton Lab CC (order ${orderRef})
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: 'Your kit has landed — thank you',
    html,
    text,
  };
}
