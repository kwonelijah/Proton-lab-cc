import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import EditorialGrid from '@/components/sections/EditorialGrid'
import CTABanner from '@/components/sections/CTABanner'

export const metadata: Metadata = {
  title: 'About',
}

const editorialImages = [
  { imageSrc: 'https://picsum.photos/seed/about-1/900/1200', imageAlt: 'Proton Lab CC garment detail' },
  { imageSrc: 'https://picsum.photos/seed/about-2/600/600', imageAlt: 'Fabric close-up' },
  { imageSrc: 'https://picsum.photos/seed/about-3/600/600', imageAlt: 'Construction detail' },
]

const values = [
  {
    title: 'No Compromise',
    description:
      'Every decision in our process is made in service of performance. If a material, panel, or construction technique does not improve the garment, it is removed.',
  },
  {
    title: 'Precision Engineering',
    description:
      'We test in wind tunnels, train with athletes, and iterate relentlessly. The garments you wear are the result of months of refinement, not seasons.',
  },
  {
    title: 'Restrained Identity',
    description:
      'We believe the garment should do the talking. Our monochrome palette is a deliberate choice — stripping back colour until only what matters remains.',
  },
]

export default function AboutPage() {
  return (
    <PageWrapper>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-3xl">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            The Brand
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none mb-10">
            About Proton Lab CC
          </h1>
          <p className="text-lg md:text-xl text-proton-black leading-relaxed">
            We started with a single question: what would cycling apparel look like if performance
            was the only brief? No colour for colour&apos;s sake. No branding for visibility&apos;s sake.
            Just the pursuit of the best garment we could make.
          </p>
          <p className="mt-6 text-proton-grey leading-relaxed">
            Proton Lab CC is built on the belief that premium cycling apparel should be engineered
            with the same rigour as the bikes it is worn on. Every panel has a reason to exist.
            Every seam placement has been tested. Every fabric has been selected against a performance
            specification, not a trend forecast.
          </p>
          <p className="mt-4 text-proton-grey leading-relaxed">
            We are based in the United Kingdom, working with European manufacturing partners who
            share our standards for quality and construction. Small-batch production. Continuous
            iteration. No compromise.
          </p>
        </div>
      </div>

      {/* Editorial grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mb-24">
        <EditorialGrid items={editorialImages} />
      </div>

      {/* Values */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 mb-16">
        <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-12">
          What We Stand For
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {values.map(value => (
            <div key={value.title}>
              <h3 className="font-playfair text-2xl mb-4">{value.title}</h3>
              <p className="text-sm text-proton-grey leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Origin strip */}
      <div className="border-t border-proton-light py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <p className="font-playfair text-2xl md:text-3xl">
            Engineered in the United Kingdom.
          </p>
          <p className="text-[10px] text-proton-grey uppercase tracking-widest">
            Est. 2026
          </p>
        </div>
      </div>

      <CTABanner
        eyebrow="The Collections"
        headline="See what we have built."
        ctaText="Shop"
        ctaHref="/collections"
      />
    </PageWrapper>
  )
}
