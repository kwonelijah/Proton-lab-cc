import type { Metadata } from 'next'
import Link from 'next/link'
import PageWrapper from '@/components/layout/PageWrapper'

// Giveaway terms for the women's kit survey (/womens). Statically rendered
// and indexable. Linked from the survey's fine print.
export const metadata: Metadata = {
  title: "Women's Kit Survey — Giveaway Terms & Conditions",
  description:
    "Terms and conditions for the Proton Lab Women's Cycling Kit survey giveaway: eligibility, entry period, prize details, winner selection and data handling.",
}

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: '1. The Promoter',
    body: (
      <>
        The promoter is Proton Sports Management Ltd, trading as Proton Lab
        (&ldquo;the Promoter&rdquo;), operator of protonlab.cc. Contact:{' '}
        <a href="mailto:info@protonlab.cc" className="underline hover:text-proton-black transition-colors duration-200">
          info@protonlab.cc
        </a>
        .
      </>
    ),
  },
  {
    heading: '2. Eligibility',
    body: (
      <>
        The giveaway is open to residents of the United Kingdom aged 18 or
        over, except employees of the Promoter and their immediate families.
        No purchase is necessary to enter.
      </>
    ),
  },
  {
    heading: '3. How to Enter',
    body: (
      <>
        To enter, complete the Women&apos;s Cycling Kit survey at protonlab.cc
        in full and submit a valid email address. One entry per person.
        Duplicate, automated, or incomplete entries will be disqualified.
      </>
    ),
  },
  {
    heading: '4. Entry Period',
    body: (
      <>
        The giveaway opens on 16 August 2026 and closes at 23:59 (UK time) on
        31 December 2026. Entries received after the closing date will not be
        counted.
      </>
    ),
  },
  {
    heading: '5. The Prize',
    body: (
      <>
        One winner will receive one full three-piece set from the Proton Lab
        Women&apos;s Collection (jersey, bib shorts, and one additional
        piece), with a combined retail value in excess of £300. The
        Women&apos;s Collection is in development: the prize will be delivered
        after the collection launches, in the winner&apos;s choice of
        available size and colourway. The prize is non-transferable and no
        cash alternative is available. If the prize becomes unavailable, the
        Promoter reserves the right to substitute a prize of equal or greater
        value.
      </>
    ),
  },
  {
    heading: '6. Winner Selection and Notification',
    body: (
      <>
        The winner will be selected at random from all valid entries within 14
        days of the closing date. The winner will be notified by email and
        must respond within 14 days to claim the prize, failing which the
        Promoter reserves the right to draw an alternative winner.
      </>
    ),
  },
  {
    heading: '7. Discount Code',
    body: (
      <>
        All valid entrants will receive a 20% discount code by email. The code
        is valid for one use on any full-price item at protonlab.cc, cannot be
        combined with other offers, and expires on 31 December 2026. The
        Promoter reserves the right to withdraw or amend the code in the event
        of misuse.
      </>
    ),
  },
  {
    heading: '8. Data and Privacy',
    body: (
      <>
        Survey responses and email addresses are collected by the Promoter to
        administer the giveaway, deliver the discount code, inform the design
        of the Women&apos;s Collection, and send marketing communications from
        Proton Lab. Entrants may unsubscribe at any time. Data is handled in
        accordance with UK GDPR and will not be sold to third parties. For
        full details of how we handle your data, see our{' '}
        <Link href="/privacy" className="underline hover:text-proton-black transition-colors duration-200">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    heading: '9. Meta Disclaimer',
    body: (
      <>
        This promotion is in no way sponsored, endorsed, administered by, or
        associated with Meta Platforms, Inc. (including Facebook and
        Instagram). Entrants release Meta from all liability in connection
        with this giveaway.
      </>
    ),
  },
  {
    heading: '10. General',
    body: (
      <>
        The Promoter&apos;s decision is final and no correspondence will be
        entered into. The Promoter reserves the right to cancel or amend the
        giveaway if circumstances outside its control make this unavoidable.
        By entering, you agree to these terms. These terms are governed by the
        laws of Scotland.
      </>
    ),
  },
]

export default function WomensKitTermsPage() {
  return (
    <PageWrapper>
      <div className="max-w-[65ch] mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="mb-16">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            Giveaway Terms
          </p>
          <h1 className="font-playfair text-3xl md:text-4xl leading-tight">
            Women&apos;s Kit Survey — Giveaway Terms &amp; Conditions
          </h1>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-playfair text-xl md:text-2xl mb-3 text-proton-black">
                {section.heading}
              </h2>
              <p className="text-sm text-proton-grey leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}
