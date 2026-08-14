import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import SurveyForm from './SurveyForm'

// Hidden page — not linked from navigation, excluded from search engines.
// Shared directly via Instagram / email / QR.
export const metadata: Metadata = {
  title: "We're Designing Women's Kit",
  robots: { index: false, follow: false },
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
              discount code for everyone who gives their input.
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
