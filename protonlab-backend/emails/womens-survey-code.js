// emails/womens-survey-code.js
// Women's kit survey thank-you — sent by api/womens-survey.js with the
// respondent's unique single-use 20% code. The code only travels by email,
// which is what proves the address is real. Mirrors welcome.js.
// Codes never expire (the women's range lands next year).

import {
  layout,
  heading,
  button,
  divider,
  bodyStyle,
  subduedStyle,
  eyebrowStyle,
  COLORS,
} from './theme.js';

// ─── Personal note — edit freely ─────────────────────────────────────────────
// Shown in its own paragraph after the intro, before the code. Leave as ''
// to hide it entirely.
const PERSONAL_NOTE = '';
// ─────────────────────────────────────────────────────────────────────────────

export function render({ code }) {
  const codeBlock = `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 32px 0;">
        <tr>
          <td style="background:${COLORS.light};padding:24px;text-align:center;">
            <p style="${eyebrowStyle}margin:0 0 8px 0;">Your code</p>
            <p style="font-family:'Courier New',monospace;font-size:24px;letter-spacing:0.15em;color:${COLORS.black};margin:0;font-weight:bold;">${code}</p>
          </td>
        </tr>
      </table>`;

  const noteBlock = PERSONAL_NOTE
    ? `<p style="${bodyStyle}margin:0 0 16px 0;">${PERSONAL_NOTE}</p>`
    : '';

  const html = layout(`
      ${heading('Thanks for the input!')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi,</p>
      <p style="${bodyStyle}margin:0 0 16px 0;">
        Thanks for helping us design our first Women’s focused range. Every
        answer gives us data to identify what you are looking for. We’ll keep
        you updated on the full design process.
      </p>
      ${noteBlock}
      <p style="${bodyStyle}margin:0 0 32px 0;">
        As promised, here’s 20% off your next order, and you’re in the draw
        for one of three sets of the finished range. The code doesn’t expire,
        so you can save it for the women’s range itself.
      </p>

      ${codeBlock}

      ${button('Shop the range', 'https://protonlab.cc/shop', 'center')}

      ${divider()}

      <p style="${subduedStyle}font-size:12px;margin:0 0 8px 0;">
        One use per code. Not valid on club kit.
      </p>
      <p style="${subduedStyle}font-size:12px;margin:0;">
        You’re receiving this because you filled in the women’s kit survey at
        protonlab.cc. We’ll only send women’s-line updates if you asked for
        them — reply “unsubscribe” any time and we’ll remove you.
      </p>
`);

  const text = `Hi,

Thanks for helping us design our first Women's focused range. Every answer gives us data to identify what you are looking for. We'll keep you updated on the full design process.
${PERSONAL_NOTE ? `\n${PERSONAL_NOTE}\n` : ''}
As promised, here's 20% off your next order, and you're in the draw for one of three sets of the finished range. The code doesn't expire, so you can save it for the women's range itself.

Your code: ${code}

Shop the range: https://protonlab.cc/shop

One use per code. Not valid on club kit.

You're receiving this because you filled in the women's kit survey at protonlab.cc. We'll only send women's-line updates if you asked for them — reply "unsubscribe" any time and we'll remove you.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: 'Your 20% code — thanks for shaping the women’s line',
    html,
    text,
  };
}
