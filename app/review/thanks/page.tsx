import Link from 'next/link'
import PageWrapper from '@/components/layout/PageWrapper'
import ReviewCard from '@/components/review/ReviewCard'
import { decodeEmailParam, verifyReviewToken, clampRating } from '@/lib/review'

// Landing page for the post-purchase review email. Arrives three ways:
//  - in-email form already recorded (done=1) — show received state, allow edits
//  - star-link tap — rating pre-selected, one tap on Send records it
//  - invalid/expired link — quiet dead end, nothing recorded

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default function ReviewThanksPage({ searchParams }: PageProps) {
  const o = first(searchParams.o)
  const e = first(searchParams.e)
  const t = first(searchParams.t)
  const email = decodeEmailParam(e)
  const valid =
    first(searchParams.state) !== 'invalid' &&
    Boolean(o && e && t) &&
    verifyReviewToken(o, email, t)

  if (!valid) {
    return (
      <PageWrapper>
        <div className="max-w-lg mx-auto px-6 py-32 text-center">
          <p className="font-playfair text-4xl text-proton-black mb-4">
            This link has expired.
          </p>
          <p className="text-sm text-proton-grey leading-relaxed mb-10">
            No matter — reply to any of our emails and tell us how the
            kit&apos;s riding. We read everything.
          </p>
          <Link
            href="/"
            className="text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200"
          >
            Back to Proton Lab
          </Link>
        </div>
      </PageWrapper>
    )
  }

  const done = first(searchParams.done) === '1'

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto px-6 py-32 text-center">
        <p className="font-playfair text-4xl text-proton-black mb-4">
          Thanks for riding with us.
        </p>
        <p className="text-sm text-proton-grey leading-relaxed mb-12">
          {done
            ? 'Your review is in — adjust it below if you like.'
            : 'Tell us how the kit’s riding — every word reaches the people who design and cut the next run.'}
        </p>
        <ReviewCard
          o={o!}
          e={e!}
          t={t!}
          initialRating={clampRating(first(searchParams.r))}
          initialComment={(first(searchParams.c) || '').slice(0, 2000)}
          initialDone={done}
        />
      </div>
    </PageWrapper>
  )
}
