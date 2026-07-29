// emails/welcome.js
// Newsletter welcome — sent by api/subscribe.js with the subscriber's unique
// single-use 10% code. The code only ever travels by email.

import {
  layout,
  heading,
  button,
  divider,
  bodyStyle,
  subduedStyle,
  eyebrowStyle,
  formatDate,
  COLORS,
} from './theme.js';

export function render({ code, expiresAt }) {
  const expiry = formatDate(expiresAt);

  // The code, displayed like a ticket: eyebrow label, large tracked mono code
  // on a proton-light panel.
  const codeBlock = `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 32px 0;">
        <tr>
          <td style="background:${COLORS.light};padding:24px;text-align:center;">
            <p style="${eyebrowStyle}margin:0 0 8px 0;">Your code</p>
            <p style="font-family:'Courier New',monospace;font-size:24px;letter-spacing:0.15em;color:${COLORS.black};margin:0;font-weight:bold;">${code}</p>
          </td>
        </tr>
      </table>`;

  const html = layout(`
      ${heading('Welcome — here’s 10% off')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi,</p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        Thanks for joining Proton Lab. Here’s your welcome code — enter it at
        checkout for 10% off your first order from the retail range.
      </p>

      ${codeBlock}

      ${button('Shop the range', 'https://protonlab.cc/shop', 'center')}

      ${divider()}

      <p style="${subduedStyle}font-size:12px;margin:0 0 8px 0;">
        One use per code, valid on the retail range until ${expiry}.
        Not valid on club kit.
      </p>
      <p style="${subduedStyle}font-size:12px;margin:0;">
        You’re receiving this because you signed up at protonlab.cc.
        Don’t want emails from us? Reply with “unsubscribe” and we’ll
        remove you.
      </p>
`);

  const text = `Hi,

Thanks for joining Proton Lab. Here's your welcome code — enter it at checkout for 10% off your first order from the retail range.

Your code: ${code}

Shop the range: https://protonlab.cc/shop

One use per code, valid on the retail range until ${expiry}. Not valid on club kit.

You're receiving this because you signed up at protonlab.cc. Don't want emails from us? Reply with "unsubscribe" and we'll remove you.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: 'Your 10% welcome code — Proton Lab',
    html,
    text,
  };
}
