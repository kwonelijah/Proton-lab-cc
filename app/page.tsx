import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/sections/HeroSection'
import CTABanner from '@/components/sections/CTABanner'
import EditorialGrid from '@/components/sections/EditorialGrid'
import CollectionCard from '@/components/ui/CollectionCard'
import JournalCard from '@/components/ui/JournalCard'
import { getCollections, getJournalPosts } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Proton Lab CC — Premium Cycling Apparel',
  description:
    'Precision-engineered cycling apparel for those who train and race without compromise.',
}

const editorialImages = [
  {
    imageSrc: 'https://picsum.photos/seed/home-ed-1/900/1200',
    imageAlt: 'Proton Lab CC apparel detail',
  },
  {
    imageSrc: 'https://picsum.photos/seed/home-ed-2/600/600',
    imageAlt: 'Fabric construction detail',
  },
  {
    imageSrc: 'https://picsum.photos/seed/home-ed-3/600/600',
    imageAlt: 'Athlete wearing Proton Lab CC',
  },
]

export default async function HomePage() {
  const [collections, posts] = await Promise.all([
    getCollections(),
    getJournalPosts(),
  ])

  return (
    <>
      <Navbar />

      {/* 1. Hero */}
      <HeroSection
        eyebrow="Proton Lab CC — SS26"
        headline="No Compromise."
        subheadline="Premium cycling apparel precision-engineered for those who train and race without limits."
        ctaText="Explore Collections"
        ctaHref="/collections"
        imageSrc="https://picsum.photos/seed/hero-main/1600/1000"
        imageAlt="Cyclist in Proton Lab CC apparel"
      />

      {/* 2. Brand statement */}
      <section className="py-20 md:py-28 px-6 md:px-12 border-b border-proton-light">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <p className="font-playfair text-3xl md:text-4xl max-w-xl leading-snug">
            Engineered in the wind tunnel.<br />Refined on the road.
          </p>
          <div className="max-w-sm">
            <p className="text-sm text-proton-grey leading-relaxed">
              Every Proton Lab CC garment is the result of months of development with athletes
              who race at the highest level. No colour for its own sake. No feature without
              a reason. Just the pursuit of the perfect garment.
            </p>
            <Link
              href="/about"
              className="inline-block mt-6 text-[10px] uppercase tracking-widest text-proton-black border-b border-proton-black pb-0.5 hover:opacity-60 transition-opacity duration-200"
            >
              About Proton Lab
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Collections */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">
                Current Season
              </p>
              <h2 className="font-playfair text-4xl md:text-5xl leading-none">
                Collections
              </h2>
            </div>
            <Link
              href="/collections"
              className="hidden md:inline-block text-[10px] uppercase tracking-widest text-proton-grey border-b border-proton-grey pb-0.5 hover:text-proton-black hover:border-proton-black transition-colors duration-200"
            >
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {collections.map((collection, i) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                priority={i < 3}
              />
            ))}
          </div>

          <div className="mt-10 md:hidden text-center">
            <Link
              href="/collections"
              className="text-[10px] uppercase tracking-widest text-proton-grey border-b border-proton-grey pb-0.5"
            >
              View All Collections
            </Link>
          </div>
        </div>
      </section>

      {/* 4. CTA banner — wind tunnel story */}
      <CTABanner
        eyebrow="Development"
        headline="Engineered in the wind tunnel."
        ctaText="Read the Story"
        ctaHref="/journal/wind-tunnel-testing-aero-series"
        inverted
      />

      {/* 5. Editorial section */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">
                The Brand
              </p>
              <h2 className="font-playfair text-4xl md:text-5xl leading-none">
                No colour.<br />No compromise.
              </h2>
            </div>
            <Link
              href="/about"
              className="hidden md:inline-block text-[10px] uppercase tracking-widest text-proton-grey border-b border-proton-grey pb-0.5 hover:text-proton-black hover:border-proton-black transition-colors duration-200"
            >
              About Us
            </Link>
          </div>
          <EditorialGrid items={editorialImages} />
        </div>
      </section>

      {/* 6. Journal */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-proton-light">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">
                Stories
              </p>
              <h2 className="font-playfair text-4xl md:text-5xl leading-none">Journal</h2>
            </div>
            <Link
              href="/journal"
              className="hidden md:inline-block text-[10px] uppercase tracking-widest text-proton-grey border-b border-proton-grey pb-0.5 hover:text-proton-black hover:border-proton-black transition-colors duration-200"
            >
              All Articles
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {posts.map((post, i) => (
              <JournalCard key={post.id} post={post} priority={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final CTA */}
      <CTABanner
        headline="Ride without limits."
        ctaText="Shop Now"
        ctaHref="/collections"
      />

      <Footer />
    </>
  )
}
