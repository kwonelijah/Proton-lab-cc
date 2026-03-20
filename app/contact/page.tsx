import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact',
}

export default function ContactPage() {
  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header */}
        <div className="max-w-2xl mb-16 md:mb-24">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            Get in Touch
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none">Contact</h1>
          <p className="mt-6 text-proton-grey leading-relaxed">
            Questions about sizing, team store enquiries, or media requests — we read everything.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          {/* Form */}
          <ContactForm />

          {/* Info */}
          <div className="space-y-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                Email
              </p>
              <p className="text-sm text-proton-black">info@protonlab.cc</p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
