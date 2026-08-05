// emails/theme.js
// Proton Lab CC email design system — the email-safe translation of
// ~/Desktop/CLAUDE/protonlabbrand.md. Every customer email renders through
// these helpers so the palette, type scale, and layout stay consistent.
//
// Email-client constraints applied:
//  - Web fonts (Playfair Display / Montserrat) are stripped by Gmail and
//    Outlook, so the site fonts map to stacks that keep the same roles:
//    serif display for headings, neutral sans for body.
//  - All styles are inline; no <style> blocks, no flex/grid.

// ─── Palette (tailwind.config.ts — never use values outside this) ───────────

export const COLORS = {
  black: '#0a0a0a', // proton-black — primary text, CTAs, header background
  white: '#fafafa', // proton-white — page background, inverted text
  grey: '#6b6b6b', // proton-grey  — secondary text, labels
  mid: '#c8c8c8', // proton-mid   — mid-tone borders
  light: '#e8e8e8', // proton-light — subtle borders, row separators
};

// ─── Typography ──────────────────────────────────────────────────────────────

export const FONTS = {
  // Playfair Display role — display headings, editorial pull quotes
  display: "Georgia, 'Times New Roman', serif",
  // Montserrat role — body copy, labels, buttons, captions
  body: "Helvetica, Arial, sans-serif",
};

// Section labels / eyebrows: 10px uppercase tracking-widest text-proton-grey
export const eyebrowStyle = `font-family:${FONTS.body};font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:${COLORS.grey};`;

// Body copy: text-sm leading-relaxed on proton-black
export const bodyStyle = `font-family:${FONTS.body};font-size:14px;line-height:1.6;color:${COLORS.black};`;

// Subdued body — labels/secondary only, never long-form copy
export const subduedStyle = `font-family:${FONTS.body};font-size:14px;line-height:1.6;color:${COLORS.grey};`;

// ─── Building blocks ─────────────────────────────────────────────────────────

// Display heading, echoing the site's Playfair page headings.
export function heading(title) {
  return `
      <h1 style="font-family:${FONTS.display};font-weight:normal;font-size:28px;line-height:1.1;color:${COLORS.black};margin:0 0 24px 0;">${title}</h1>`;
}

// Detail table: rows of [label, valueHtml], styled like the site's
// label/value rows with proton-light separators. A vertical proton-light rule
// runs down the middle: labels sit in the left half, all values in the right.
// Pass bold: true on a row object ({ label, value, bold: true }) for totals.
export function detailTable(rows) {
  const cells = rows
    .filter(Boolean)
    .map((row, i, arr) => {
      const border = i < arr.length - 1 ? `border-bottom:1px solid ${COLORS.light};` : '';
      const weight = row.bold ? 'font-weight:bold;' : '';
      return `
        <tr>
          <td style="padding:12px 16px 12px 0;${border}${eyebrowStyle}width:50%;vertical-align:top;">${row.label}</td>
          <td style="padding:12px 0 12px 16px;${border}border-left:1px solid ${COLORS.light};font-family:${FONTS.body};font-size:13px;line-height:1.6;color:${COLORS.black};${weight}">${row.value}</td>
        </tr>`;
    })
    .join('');
  return `
      <table style="width:100%;border-collapse:collapse;margin:0 0 32px 0;">${cells}
      </table>`;
}

// Primary button — black fill, white text, uppercase tracked label
// (Button.tsx primary variant). Padding keeps a 44px+ touch target.
// align: 'left' | 'center' | 'right'. The nested table with an align attribute
// is the email-safe way to align a shrink-wrapped block (works in Outlook).
export function button(label, href, align = 'left') {
  return `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 32px 0;">
        <tr>
          <td>
            <table role="presentation" align="${align}" style="border-collapse:collapse;">
              <tr>
                <td style="background:${COLORS.black};">
                  <a href="${href}" style="display:inline-block;padding:15px 32px;font-family:${FONTS.body};font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${COLORS.white};text-decoration:none;">${label}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

// Section divider — border-t border-proton-light
export function divider() {
  return `<hr style="border:none;border-top:1px solid ${COLORS.light};margin:0 0 24px 0;" />`;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

// Wraps rendered body content in the shared shell: white logo header,
// proton-white canvas, black footer band. Every customer email uses this.
//
// The footer uses the pre-made halves in the site's public/email/ folder
// (720px + 480px wide = a 60/40 split of the black band): the logo lockup
// links to protonlab.cc, the Instagram icon links to @protonlabcc.
export function layout(bodyHtml) {
  return `
    <div style="background:${COLORS.white};margin:0 auto;max-width:600px;">

      <div style="background:${COLORS.white};text-align:center;padding:18px 20px;border-bottom:1px solid ${COLORS.light};">
        <img src="https://protonlab.cc/email/logo-black.png" alt="Proton Lab CC" width="190" style="display:inline-block;width:190px;max-width:62%;height:auto;border:0;" />
      </div>

      <div style="padding:36px 24px;">
${bodyHtml}
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="background:${COLORS.black};padding:0;width:60%;">
            <a href="https://protonlab.cc" style="display:block;">
              <img src="https://protonlab.cc/email/footer-left.png" alt="Proton Lab — protonlab.cc" width="360" style="display:block;width:100%;height:auto;border:0;" />
            </a>
          </td>
          <td style="background:${COLORS.black};padding:0;width:40%;">
            <a href="https://www.instagram.com/protonlabcc/" style="display:block;">
              <img src="https://protonlab.cc/email/footer-right.png" alt="Instagram — @protonlabcc" width="240" style="display:block;width:100%;height:auto;border:0;" />
            </a>
          </td>
        </tr>
      </table>

    </div>
  `;
}

// ─── Shared order formatters ─────────────────────────────────────────────────

// Formats a Stripe `shipping` object into address lines. Returns null if no
// address was collected, so callers can omit the delivery block entirely.
export function formatShipping(shipping) {
  if (!shipping || !shipping.address) return null;
  const a = shipping.address;
  const lines = [
    shipping.name,
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(' '),
    a.state,
    a.country,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return { html: lines.join('<br>'), text: lines.join('\n') };
}

// Renders order line items with their sizes: "SS Race Jersey — Size M × 2".
// Falls back to the plain product-names string if no line-item data is present.
export function formatItems(order) {
  const items = Array.isArray(order.lineItems) ? order.lineItems : [];
  if (items.length === 0) {
    const fallback = order.product || 'your order';
    return { html: fallback, text: fallback };
  }
  const line = (i) => {
    const name = i.name || i.handle || 'Item';
    const parts = [];
    if (i.size) parts.push(`Size ${i.size}`);
    if (i.qty && i.qty > 1) parts.push(`× ${i.qty}`);
    return parts.length ? `${name} — ${parts.join(' ')}` : name;
  };
  return {
    html: items.map(line).join('<br>'),
    text: items.map(line).join('\n'),
  };
}

// First name for greetings, or "there" when no usable name was collected.
export function firstName(order) {
  return order.name && order.name !== 'N/A' ? order.name.split(' ')[0] : 'there';
}

// dd Month yyyy in en-GB, matching the site's editorial date style.
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// £ for GBP orders, € for EUR — order.currency comes from Stripe via the
// webhook, so amounts and symbol always agree.
export function currencySymbol(currency) {
  return String(currency || 'GBP').toUpperCase() === 'EUR' ? '€' : '£';
}
