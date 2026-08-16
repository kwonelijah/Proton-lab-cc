import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'

// Site privacy policy. Statically rendered and indexable; linked from the
// footer and from the giveaway T&Cs (/womens-kit-terms).
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Proton Lab collects, uses and protects your data: what we collect, why, how long we keep it, and your rights under UK GDPR.',
}

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: '1. Who we are',
    body: (
      <>
        Proton Sports Management Ltd, trading as Proton Lab, operates
        protonlab.cc. For anything relating to your data, contact{' '}
        <a href="mailto:info@protonlab.cc" className="underline hover:text-proton-black transition-colors duration-200">
          info@protonlab.cc
        </a>
        .
      </>
    ),
  },
  {
    heading: '2. What we collect',
    body: (
      <>
        Email addresses (when you join the mailing list, complete a survey, or
        place an order); survey responses; order details such as your name,
        delivery address and items purchased (card details are processed by
        Stripe and never reach us); and analytics data collected through the
        Meta Pixel and Google Analytics, such as pages viewed and how you
        arrived at the site.
      </>
    ),
  },
  {
    heading: '3. Why we collect it',
    body: (
      <>
        To fulfil and deliver orders, to send marketing emails you have
        signed up for, to inform product development (survey answers shape
        what we design next), and to understand how the site is used so we
        can improve it.
      </>
    ),
  },
  {
    heading: '4. Lawful basis',
    body: (
      <>
        Marketing emails are sent on the basis of your consent, which you can
        withdraw at any time. Order data is processed because it is necessary
        to perform our contract with you.
      </>
    ),
  },
  {
    heading: '5. How long we keep it',
    body: (
      <>
        Order records are kept as long as accounting rules require. Mailing
        list details are kept until you unsubscribe. Survey responses are
        kept while the product development they inform is ongoing.
      </>
    ),
  },
  {
    heading: '6. Your rights',
    body: (
      <>
        You can ask for a copy of the data we hold about you, ask us to
        correct it, or ask us to delete it at any time by emailing{' '}
        <a href="mailto:info@protonlab.cc" className="underline hover:text-proton-black transition-colors duration-200">
          info@protonlab.cc
        </a>
        . Every marketing email includes an unsubscribe link, and you can
        also unsubscribe by replying to any of our emails.
      </>
    ),
  },
  {
    heading: '7. Third parties',
    body: (
      <>
        We never sell your data. It is shared only with the services that run
        the shop: Stripe (payments), Evri (delivery), Resend (email), Vercel
        (hosting), and Meta and Google (analytics), each of which processes
        it under their own safeguards.
      </>
    ),
  },
  {
    heading: '8. Complaints',
    body: (
      <>
        We handle data in accordance with UK GDPR. If you are unhappy with
        how we have handled your data, contact us first and we will do our
        best to put it right; you also have the right to complain to the
        Information Commissioner&apos;s Office (ico.org.uk).
      </>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <PageWrapper>
      <div className="max-w-[65ch] mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="mb-16">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            Privacy
          </p>
          <h1 className="font-playfair text-3xl md:text-4xl leading-tight">Privacy Policy</h1>
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
