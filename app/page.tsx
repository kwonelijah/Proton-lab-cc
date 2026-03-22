import type { Metadata } from 'next'
import Image from 'next/image'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import VideoHero from '@/components/sections/VideoHero'
import CTABanner from '@/components/sections/CTABanner'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Proton Lab CC — Premium Cycling Apparel',
  description:
    'Precision-engineered cycling apparel for those who train and race without compromise.',
}

export default async function HomePage() {
  return (
    <>
      <Navbar />

      {/* 1. Hero */}
      <VideoHero
        videoSrc="https://zpwxsatldyroswl1.public.blob.vercel-storage.com/PLHomepageClip.mov"
        eyebrow="Proton Lab CC"
        headline="No Compromise."
        subheadline="Premium cycling apparel precision-engineered for those who train and race."
        ctaText="Shop"
        ctaHref="/shop"
        secondaryCtaText="Custom Kit"
        secondaryCtaHref="/custom"
      />

      {/* 2. Two-path CTA */}
      <section className="py-24 md:py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/shop" className="group relative overflow-hidden aspect-[4/3] bg-proton-light flex items-end">
            <Image
              src="/images/homepage/homepagecollection.JPG"
              alt="Shop"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-proton-black/40 group-hover:bg-proton-black/55 transition-colors duration-300" />
            <div className="relative z-10 p-8 md:p-10">
              <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">Ready to Ship</p>
              <h2 className="font-playfair text-4xl text-proton-white leading-none">Shop</h2>
              <span className="inline-block mt-4 text-xs uppercase tracking-widest text-proton-white border-b border-proton-white pb-0.5">
                Shop Now
              </span>
            </div>
          </Link>
          <Link href="/custom" className="group relative overflow-hidden aspect-[4/3] bg-proton-black flex items-end">
            <Image
              src="/images/homepage/homepagecustom.jpg"
              alt="Custom Kit"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-proton-black/40 group-hover:bg-proton-black/55 transition-colors duration-300" />
            <div className="relative z-10 p-8 md:p-10">
              <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">Made to Order</p>
              <h2 className="font-playfair text-4xl text-proton-white leading-none">Custom Kit</h2>
              <span className="inline-block mt-4 text-xs uppercase tracking-widest text-proton-white border-b border-proton-white pb-0.5">
                Learn More
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 3. Final CTA */}
      <CTABanner
        headline="Ride without limits."
        ctaText="Shop Now"
        ctaHref="/shop"
      />

      <Footer />
    </>
  )
}
