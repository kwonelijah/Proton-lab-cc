// Shared logic for the post-purchase review flow. The email template in
// protonlab-backend/emails/review-request.js mints HMAC tokens with the same
// REVIEW_TOKEN_SECRET; this side verifies them and forwards submissions to
// the team inbox via Resend (mirroring app/api/contact/route.ts).

import { createHmac, timingSafeEqual } from 'crypto'
import { Resend } from 'resend'

export interface ReviewSubmission {
  orderRef: string
  email: string
  rating: number
  comment?: string
  updated?: boolean
}

export function decodeEmailParam(e: string | undefined | null): string | null {
  if (!e) return null
  try {
    const email = Buffer.from(e, 'base64url').toString('utf8')
    return email.includes('@') ? email : null
  } catch {
    return null
  }
}

export function verifyReviewToken(
  orderRef: string | undefined | null,
  email: string | null,
  token: string | undefined | null
): boolean {
  const secret = process.env.REVIEW_TOKEN_SECRET
  if (!secret || !orderRef || !email || !token) return false
  const expected = createHmac('sha256', secret)
    .update(`${orderRef}|${email.toLowerCase()}`)
    .digest('hex')
    .slice(0, 20)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function clampRating(r: unknown): number | null {
  const n = typeof r === 'string' ? parseInt(r, 10) : typeof r === 'number' ? r : NaN
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Sends the review to info@ like a contact-form message. Repeat submissions
// for the same order simply arrive as "Updated" — no dedupe store needed at
// this volume.
export async function sendReviewNotification({
  orderRef,
  email,
  rating,
  comment,
  updated,
}: ReviewSubmission): Promise<{ ok: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const prefix = updated ? 'Updated kit review' : 'Kit review'
  const note = comment?.trim() || ''

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: 'info@protonlab.cc',
    replyTo: email,
    subject: `${prefix}: order ${orderRef} — ${rating}/5`,
    text: `${prefix}\n\nOrder: ${orderRef}\nCustomer: ${email}\nRating: ${stars} (${rating}/5)\n\n${note || 'No comment left.'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;margin-bottom:24px;">${prefix}</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;width:100px;color:#666;font-size:13px;">Order</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${escapeHtml(orderRef)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Customer</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">
              <a href="mailto:${escapeHtml(email)}" style="color:#1a1a1a;">${escapeHtml(email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Rating</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:16px;letter-spacing:2px;">${stars} <span style="font-size:13px;color:#666;">(${rating}/5)</span></td>
          </tr>
        </table>
        <p style="font-size:13px;color:#666;margin-bottom:8px;">Comment</p>
        <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${note ? escapeHtml(note) : '<em>No comment left.</em>'}</p>
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
        <p style="font-size:11px;color:#999;">Reply directly to this email to respond to the customer.</p>
      </div>
    `,
  })

  if (error) {
    console.error('Review notification failed:', error)
    return { ok: false, error: String(error) }
  }
  return { ok: true }
}
