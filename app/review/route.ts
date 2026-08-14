// GET entry point for review links in the post-purchase email.
//
// Two arrival paths:
//  - In-email form submission (Apple Mail — src=form): the customer already
//    picked a rating and typed their comment inside the email, so record it
//    immediately and land them on the thanks page in its "received" state.
//  - Star-link tap (Gmail/Outlook fallback — no src): record nothing yet.
//    Link-scanning proxies (Outlook SafeLinks etc.) prefetch these URLs, so a
//    bare GET must stay side-effect free; the thanks page arrives with the
//    rating pre-selected and one tap on "Send review" records it.

import { NextRequest, NextResponse } from 'next/server'
import {
  decodeEmailParam,
  verifyReviewToken,
  clampRating,
  sendReviewNotification,
} from '@/lib/review'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const o = params.get('o')
  const e = params.get('e')
  const t = params.get('t')
  const email = decodeEmailParam(e)

  const thanks = new URL('/review/thanks', req.nextUrl.origin)

  if (!o || !e || !t || !email || !verifyReviewToken(o, email, t)) {
    thanks.searchParams.set('state', 'invalid')
    return NextResponse.redirect(thanks, 303)
  }

  const rating = clampRating(params.get('r'))
  const comment = (params.get('c') || '').slice(0, 2000)
  const fromEmailForm = params.get('src') === 'form'

  thanks.searchParams.set('o', o)
  thanks.searchParams.set('e', e)
  thanks.searchParams.set('t', t)
  if (rating) thanks.searchParams.set('r', String(rating))
  if (comment) thanks.searchParams.set('c', comment)

  if (fromEmailForm && rating) {
    const sent = await sendReviewNotification({ orderRef: o, email, rating, comment })
    if (sent.ok) thanks.searchParams.set('done', '1')
  }

  return NextResponse.redirect(thanks, 303)
}
