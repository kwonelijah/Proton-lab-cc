import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import SurveyForm from './SurveyForm'

// Hidden page — not linked from navigation, excluded from search engines.
// Shared directly via Instagram / email / QR, so the link-preview card
// (og tags below) carries its own women's-specific text and image.
const OG_DESCRIPTION =
  "We're designing our first women's range from the ground up and we want your input. Two minutes of questions, a 20% code for your next order, and three sets of the finished kit to give away."

export const metadata: Metadata = {
  title: "We're Designing Women's Kit",
  description: OG_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: "We're Designing Women's Kit. We Want Your Help.",
    description: OG_DESCRIPTION,
    images: [
      {
        url: '/images/womens/og.jpg',
        width: 1200,
        height: 630,
        alt: "Women's bib shorts — help design the Proton Lab women's range",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "We're Designing Women's Kit. We Want Your Help.",
    description: OG_DESCRIPTION,
  },
}

export default function WomensSurveyPage() {
  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="mb-16 md:mb-20">
          <h1 className="font-playfair text-3xl md:text-4xl leading-tight mb-6">
            We&apos;re designing women&apos;s kit. We want your help.
          </h1>
          <div className="space-y-4 text-sm text-proton-grey leading-relaxed">
            <p>
              We know how important designing for purpose is, and we weren&apos;t
              happy with our current women&apos;s products. So that&apos;s why
              we&apos;re designing a new range from the ground up. That&apos;s
              where you come in, give us your preferences, non-negotiables,
              products you like and hate.
            </p>
            <p>
              We&apos;re giving away 3 sets of the completed range, and a 20%
              discount code for everyone who gives their input. Winners are
              drawn from the women&apos;s line mailing list, so stay subscribed
              to be entered.
            </p>
            <p className="text-proton-black">
              Thanks,
              <br />
              Elijah (Founder)
            </p>
          </div>
        </div>

        <SurveyForm />
      </div>
    </PageWrapper>
  )
}
