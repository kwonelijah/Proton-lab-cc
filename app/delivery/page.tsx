import type { Metadata } from 'next'
import Link from 'next/link'
import PageWrapper from '@/components/layout/PageWrapper'

// Rates and timings mirror protonlab-backend/config/shipping.js — update both
// together, and keep components/ui/DeliveryNote.tsx in step.

export const metadata: Metadata = {
  title: 'Delivery',
  description:
    'Delivery rates, timings and customs information for UK, Ireland and European orders from Proton Lab CC.',
}

export default function DeliveryPage() {
  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header */}
        <div className="max-w-2xl mb-16 md:mb-24">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            Delivery Information
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none">Delivery</h1>
          <p className="mt-6 text-proton-grey leading-relaxed">
            Every order is dispatched from the United Kingdom with Evri. We ship to the UK,
            Ireland and Europe — rates, timings and customs information below.
          </p>
        </div>

        {/* Rates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-16">
          {/* United Kingdom */}
          <div>
            <h2 className="font-playfair text-2xl mb-6">United Kingdom</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                  Standard Delivery
                </p>
                <p className="text-sm text-proton-black">£2.99 — 2–4 working days</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                  Next-Day Delivery
                </p>
                <p className="text-sm text-proton-black">£4.99 — 1 working day</p>
              </div>
              <p className="text-sm text-proton-grey leading-relaxed">
                Standard delivery is free on orders over £110.
              </p>
            </div>
          </div>

          {/* Ireland */}
          <div>
            <h2 className="font-playfair text-2xl mb-6">Ireland</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                  Standard Delivery
                </p>
                <p className="text-sm text-proton-black">€3.49 — 2–4 working days</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                  Next-Day Delivery
                </p>
                <p className="text-sm text-proton-black">€5.99 — 1 working day</p>
              </div>
              <p className="text-sm text-proton-grey leading-relaxed">
                Standard delivery is free on orders over €150.
              </p>
            </div>
          </div>

          {/* Europe */}
          <div>
            <h2 className="font-playfair text-2xl mb-6">Europe</h2>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">
                  European Delivery
                </p>
                <p className="text-sm text-proton-black">€6.99 — 5–10 working days</p>
              </div>
              <p className="text-sm text-proton-grey leading-relaxed">
                Delivery is free on orders over €150. European orders may incur customs
                charges on arrival — see below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Where we ship */}
      <div className="border-t border-proton-light py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-2xl">
            <h2 className="font-playfair text-2xl mb-4">Where We Ship</h2>
            <p className="text-sm text-proton-black leading-relaxed">
              We deliver to the United Kingdom, Ireland and the rest of Europe — every EU
              member state, plus Switzerland, Norway, Iceland, Liechtenstein and Monaco.
              Ireland is served by the same delivery services as the UK, priced in euros.
              Your delivery region is selected in the cart and sets the currency you pay
              in — orders delivered to the UK are charged in pounds; orders delivered to
              Ireland or Europe are charged in euros.
            </p>
          </div>
        </div>
      </div>

      {/* Customs & import duties */}
      <div className="border-t border-proton-light py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-2xl">
            <h2 className="font-playfair text-2xl mb-4">Customs &amp; Import Duties</h2>
            <p className="text-sm text-proton-black leading-relaxed">
              Orders to Europe are shipped from the United Kingdom, which means they pass
              through customs on arrival. Customs charges and import duties are not covered
              by Proton Lab — you may be asked to pay local VAT, import duty or a carrier
              handling fee before your parcel is released.
            </p>
            <p className="mt-4 text-sm text-proton-grey leading-relaxed">
              These charges are set by the destination country and collected by the carrier
              or local customs authority. We cannot calculate or pre-pay them at checkout,
              and they are not included in our prices or delivery rates.
            </p>
            <p className="mt-4 text-sm text-proton-grey leading-relaxed">
              If you are unsure what your country charges on imports from the UK, check with
              your local customs authority before ordering.
            </p>
          </div>
        </div>
      </div>

      {/* Rest of world */}
      <div className="border-t border-proton-light py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-2xl">
            <h2 className="font-playfair text-2xl mb-4">Outside the UK &amp; Europe</h2>
            <p className="text-sm text-proton-grey leading-relaxed">
              We do not currently ship beyond the UK, Ireland and Europe. If you would like
              to order from elsewhere,{' '}
              <Link
                href="/contact"
                className="text-proton-black underline underline-offset-2 hover:text-proton-grey transition-colors duration-200"
              >
                contact us
              </Link>{' '}
              and we will let you know if we can arrange it.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
