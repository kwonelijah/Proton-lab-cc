'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/types/product'
import { formatPrice } from '@/lib/utils'

// Rotating cross-sell banner for the "Complete the Kit" row on product pages.
// The image column is sized identically to the product cards in the row
// below (one grid column, 2:3 frame), so both rows read at the same scale.
// Auto-advances with a crossfade, pauses on hover/focus; arrow + dot
// controls follow KitCarousel's pattern.

interface CompleteKitBannerProps {
  products: Product[]
  // Jersey banners run image-left; bib-short banners mirror to image-right so
  // the two cross-sell directions read differently at a glance.
  imageSide?: 'left' | 'right'
}

export default function CompleteKitBanner({ products, imageSide = 'left' }: CompleteKitBannerProps) {
  const [index, setIndex] = useState(0)
  const pausedRef = useRef(false)
  const count = products.length

  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count])
  const next = useCallback(() => setIndex(i => (i + 1) % count), [count])

  useEffect(() => {
    if (count < 2) return
    const timer = setInterval(() => {
      if (!pausedRef.current) next()
    }, 4000)
    return () => clearInterval(timer)
  }, [count, next])

  if (count === 0) return null
  const current = products[index]

  return (
    <div
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      onFocus={() => { pausedRef.current = true }}
      onBlur={() => { pausedRef.current = false }}
    >
      {/* Slides stack in one grid cell (not absolute) so the banner's height
          comes from the image column — the same 2:3 card as the row below. */}
      <Link
        href={`/products/${current.handle}`}
        aria-label={`${current.title} — ${formatPrice(current.priceRange.minVariantPrice.amount, current.priceRange.minVariantPrice.currencyCode)}`}
        className="group relative grid bg-proton-light overflow-hidden"
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            aria-hidden={i !== index}
            className={`col-start-1 row-start-1 grid grid-cols-2 md:grid-cols-3 gap-x-4 md:gap-x-6 items-center ${
              i === index ? '' : 'pointer-events-none'
            }`}
          >
            {/* Product image — one grid column in a 2:3 frame, exactly like a
                ProductCard below. Images crossfade slowly; text fades faster
                so outgoing and incoming titles never read doubled. */}
            <div
              className={`relative w-full transition-opacity duration-700 ${
                imageSide === 'right' ? 'order-last' : ''
              } ${i === index ? 'opacity-100' : 'opacity-0'}`}
              style={{ aspectRatio: `${p.featuredImage.width} / ${p.featuredImage.height}` }}
            >
              <Image
                src={p.featuredImage.url}
                alt={p.featuredImage.altText ?? p.title}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                quality={90}
                className="object-cover"
              />
            </div>

            {/* Details */}
            <div
              className={`md:col-span-2 transition-opacity duration-300 ${
                imageSide === 'right'
                  ? 'pl-6 md:pl-16 pr-2 md:pr-8'
                  : 'pr-6 md:pr-16 pl-2 md:pl-8'
              } ${i === index ? 'opacity-100 delay-200' : 'opacity-0'}`}
            >
              <h3 className="font-playfair text-2xl md:text-6xl leading-tight mb-3 md:mb-5">
                {p.title}
              </h3>
              <p className="text-sm md:text-2xl text-proton-black mb-6 md:mb-10">
                {formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode)}
              </p>
              <span className="inline-block text-[10px] md:text-sm uppercase tracking-widest text-proton-black underline underline-offset-4 group-hover:opacity-60 transition-opacity duration-200">
                View
              </span>
            </div>
          </div>
        ))}
      </Link>

      {/* Controls — arrows flanking the slide dots, KitCarousel style */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-6 mt-5">
          <button
            onClick={prev}
            aria-label="Previous"
            className="text-proton-black/40 hover:text-proton-black transition-colors duration-200 text-lg leading-none"
          >
            ←
          </button>
          <div className="flex gap-2.5">
            {products.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                aria-label={`Show ${p.title}`}
                aria-current={i === index}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === index ? 'bg-proton-black' : 'bg-proton-black/25 hover:bg-proton-black/50'
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="text-proton-black/40 hover:text-proton-black transition-colors duration-200 text-lg leading-none"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
