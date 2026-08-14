import { NextResponse } from 'next/server'
import {
  decodeEmailParam,
  verifyReviewToken,
  clampRating,
  sendReviewNotification,
} from '@/lib/review'

export async function POST(req: Request) {
  const { o, e, t, r, c, updated } = await req.json()
  const email = decodeEmailParam(e)
  const rating = clampRating(r)

  if (!o || !email || !rating || !verifyReviewToken(o, email, t)) {
    return NextResponse.json({ error: 'Invalid review link' }, { status: 400 })
  }

  const sent = await sendReviewNotification({
    orderRef: o,
    email,
    rating,
    comment: typeof c === 'string' ? c.slice(0, 2000) : '',
    updated: Boolean(updated),
  })

  if (!sent.ok) {
    return NextResponse.json({ error: 'Failed to send review' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
