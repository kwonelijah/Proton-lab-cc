// emails/review-request.js
// Review request — scheduled at dispatch time for ~2 weeks after the kit
// lands. The star rating and comment box are interactive inside the email
// where the client allows it (Apple Mail / iOS Mail render real forms);
// everywhere else a link-based fallback shows instead, so no client ever
// sees a broken form.
//
// DELIBERATE DEVIATION from theme.js's "no <style> blocks" rule: the
// tap-to-fill stars need :checked selectors, which only work from a
// stylesheet. Gmail and Outlook strip the <style> block entirely — which is
// exactly the detection mechanism: if the block survives, the client can
// also render the form, and the CSS swaps the fallback for the interactive
// version. Everything else in this template is inline, per convention.

import { createHmac } from 'crypto';
import {
  layout,
  heading,
  divider,
  bodyStyle,
  subduedStyle,
  eyebrowStyle,
  firstName,
  COLORS,
  FONTS,
} from './theme.js';

const REVIEW_URL = 'https://protonlab.cc/review';

// HMAC token binding order ref + email, so review links can't be forged or
// replayed against other orders. The same secret verifies on the frontend.
export function reviewToken(orderRef, email) {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) throw new Error('REVIEW_TOKEN_SECRET is not set in the environment');
  return createHmac('sha256', secret)
    .update(`${orderRef}|${email.toLowerCase()}`)
    .digest('hex')
    .slice(0, 20);
}

// Minimal HTML-attribute escape for interpolated order refs (club refs can
// contain ampersands or quotes).
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function render(order) {
  const greeting = firstName(order);
  const orderRef = order.ref || order.id;
  const token = reviewToken(orderRef, order.email);
  const params = `o=${encodeURIComponent(orderRef)}&e=${encodeURIComponent(
    Buffer.from(order.email.toLowerCase()).toString('base64url')
  )}&t=${token}`;
  const linkBase = `${REVIEW_URL}?${params}`;

  // ── Interactive version (Apple Mail / iOS Mail) ────────────────────────────
  // A real form: radio stars that fill on tap, a textarea, a send button.
  // Submits as a GET to /review, so the browser opens once on a thank-you
  // page with everything already recorded. Hidden by default; revealed only
  // by the gated CSS below.
  const starLabel = (n) =>
    `<input type="radio" name="r" value="${n}" id="pl-s${n}" style="display:none;" /><label for="pl-s${n}" style="font-family:${FONTS.body};font-size:36px;line-height:1;color:${COLORS.mid};padding:0 6px;display:inline-block;cursor:pointer;">&#9733;</label>`;

  const kinetic = `
        <div class="pl-kinetic" style="display:none;mso-hide:all;">
          <form action="${REVIEW_URL}" method="get">
            <input type="hidden" name="o" value="${esc(orderRef)}" />
            <input type="hidden" name="e" value="${Buffer.from(order.email.toLowerCase()).toString('base64url')}" />
            <input type="hidden" name="t" value="${token}" />
            <input type="hidden" name="src" value="form" />
            <div class="pl-stars" style="direction:rtl;text-align:center;margin:0 0 20px 0;">
              ${starLabel(5)}${starLabel(4)}${starLabel(3)}${starLabel(2)}${starLabel(1)}
            </div>
            <textarea name="c" rows="4" placeholder="How's it riding? A line or two goes a long way. (optional)" style="width:100%;box-sizing:border-box;border:1px solid ${COLORS.mid};background:#ffffff;padding:12px;font-family:${FONTS.body};font-size:14px;line-height:1.6;color:${COLORS.black};margin:0 0 20px 0;border-radius:0;-webkit-appearance:none;"></textarea>
            <div style="text-align:center;">
              <input type="submit" value="Send review" style="background:${COLORS.black};color:${COLORS.white};border:0;border-radius:0;-webkit-appearance:none;padding:15px 32px;font-family:${FONTS.body};font-size:12px;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;" />
            </div>
          </form>
        </div>`;

  // ── Fallback version (Gmail, Outlook, everyone else) ───────────────────────
  // Five star links — one tap records the rating and opens a page where a
  // note can be added. Visible by default; hidden where the kinetic form runs.
  const starLink = (n) =>
    `<td style="text-align:center;"><a href="${linkBase}&r=${n}" style="display:inline-block;font-family:${FONTS.body};font-size:34px;line-height:44px;min-width:44px;color:${COLORS.black};text-decoration:none;">&#9734;</a></td>`;

  const fallback = `
        <div class="pl-fallback">
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;">
            <tr>${[1, 2, 3, 4, 5].map(starLink).join('')}</tr>
          </table>
          <p style="${subduedStyle}font-size:12px;text-align:center;margin:0;">
            Tap a star to rate your kit — you can add a note on the page that opens.
          </p>
        </div>`;

  // ── The review module ──────────────────────────────────────────────────────
  // Gate + stylesheet, skipped entirely by Outlook's Word engine via the
  // !mso conditional. Clients that keep both the checkbox and the stylesheet
  // (the Apple Mail family) reveal the form and hide the links.
  const reviewModule = `
      <!--[if !mso]><!-->
      <input type="checkbox" id="pl-gate" checked style="display:none;max-height:0;visibility:hidden;" />
      <style>
        #pl-gate:checked ~ table .pl-kinetic { display:block !important; }
        #pl-gate:checked ~ table .pl-fallback { display:none !important; }
        .pl-stars input:checked ~ label { color:${COLORS.black} !important; }
        .pl-stars label:hover, .pl-stars label:hover ~ label { color:${COLORS.black} !important; }
      </style>
      <!--<![endif]-->
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 32px 0;">
        <tr>
          <td style="background:${COLORS.light};padding:24px;">
            <p style="${eyebrowStyle}text-align:center;margin:0 0 16px 0;">Rate your kit</p>
${kinetic}
${fallback}
          </td>
        </tr>
      </table>`;

  const html = layout(`
      ${heading('How&rsquo;s the kit riding?')}

      <p style="${bodyStyle}margin:0 0 16px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 16px 0;">
        Your kit has had a couple of weeks on the road now &mdash; long enough
        to know how it really fits, feels, and washes.
      </p>
      <p style="${bodyStyle}margin:0 0 32px 0;">
        If you&rsquo;ve got thirty seconds, tell us. Tap a star, add a line if
        you like, and press send.
      </p>

      ${reviewModule}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Every word goes straight to the people who design and cut the next run.
      </p>

      <p style="${bodyStyle}margin:0 0 32px 0;">Thanks for riding with us.</p>

      ${divider()}

      <p style="${subduedStyle}font-size:12px;margin:0;">
        You&rsquo;re receiving this because you ordered from protonlab.cc.
        Don&rsquo;t want emails like this? Reply with &ldquo;unsubscribe&rdquo;
        and we&rsquo;ll remove you.
      </p>
`);

  const text = `Hi ${greeting},

Your kit has had a couple of weeks on the road now — long enough to know how it really fits, feels, and washes.

If you've got thirty seconds, tell us how it's riding — rate your kit here:

${linkBase}

Every word goes straight to the people who design and cut the next run.

Thanks for riding with us.

You're receiving this because you ordered from protonlab.cc. Don't want emails like this? Reply with "unsubscribe" and we'll remove you.

— Proton Lab CC (order ${orderRef})
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: "Two weeks in — how's the kit riding?",
    html,
    text,
  };
}
