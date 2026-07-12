'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { formatPrice } from '@/lib/utils'

interface HomeCollectionCarouselProps {
  products: Product[]
  eyebrow?: string
  heading?: string
}

export default function HomeCollectionCarousel({
  products,
  eyebrow = 'New In',
  heading = 'Summer 2026',
}: HomeCollectionCarouselProps) {
  if (products.length === 0) return null

  // Two copies of the list so the marquee (translateX -50%) loops seamlessly.
  const loop = [...products, ...products]

  return (
    <section aria-label={`${heading} collection`} className="py-8 md:py-10 border-t border-proton-light">
      <div className="max-w-7xl mx-auto px-6 md:px-12 mb-5 md:mb-6 flex items-end justify-between">
        <div>
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-2">{eyebrow}</p>
          <h2 className="font-playfair text-3xl md:text-4xl text-proton-black leading-none">{heading}</h2>
        </div>
        <Link
          href="/shop"
          className="shrink-0 text-xs uppercase tracking-widest text-proton-black border-b border-proton-black pb-0.5 hover:opacity-60 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
        >
          View All
        </Link>
      </div>

      {/* group enables hover-to-pause; overflow hides the off-screen copies */}
      <div className="group relative overflow-hidden">
        {/* Edge fades so cards glide in/out instead of hard-cutting */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 md:w-24 bg-gradient-to-r from-proton-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 md:w-24 bg-gradient-to-l from-proton-white to-transparent" />

        <ul className="flex w-max gap-4 px-6 md:gap-6 md:px-12 animate-marquee group-hover:[animation-play-state:paused]">
          {loop.map((product, i) => {
            const isClone = i >= products.length
            const { amount, currencyCode } = product.priceRange.minVariantPrice
            const isLandscape = product.featuredImage.width > product.featuredImage.height
            const fit = isLandscape ? 'object-contain' : 'object-cover'

            return (
              <li key={`${product.id}-${i}`} className="w-[70vw] shrink-0 sm:w-[44vw] md:w-[30vw] lg:w-[23vw]">
                <Link
                  href={`/products/${product.handle}`}
                  className="group/card block"
                  aria-hidden={isClone}
                  tabIndex={isClone ? -1 : 0}
                >
                  <div className="relative aspect-[2/3] overflow-hidden bg-proton-light">
                    <Image
                      src={product.featuredImage.url}
                      alt={product.featuredImage.altText ?? product.title}
                      fill
                      sizes="(max-width: 640px) 70vw, (max-width: 1024px) 30vw, 23vw"
                      className={`${fit} transition-opacity duration-300 group-hover/card:opacity-90`}
                    />
                  </div>
                  <div className="pt-3">
                    <h3 className="font-inter text-sm leading-snug text-proton-black">{product.title}</h3>
                    <p className="mt-1 text-sm text-proton-black">{formatPrice(amount, currencyCode)}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
