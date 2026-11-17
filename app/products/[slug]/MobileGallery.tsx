'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProductImage } from '@/types/product'

interface MobileGalleryProps {
  images: ProductImage[]
  productTitle: string
}

// Phone gallery, unchanged in behaviour from the previous product page: one
// main photo at its own aspect ratio, now filling the screen width, with
// thumbnails beneath. Hidden from md up (the desktop grid takes over), so the
// main photo's `sizes` collapses to 1px there and costs nothing.
export default function MobileGallery({ images, productTitle }: MobileGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[activeIndex] ?? images[0]
  if (!active) return null

  return (
    <div className="md:hidden">
      <div
        className="relative overflow-hidden bg-proton-light border-b border-proton-black"
        style={{ aspectRatio: `${active.width} / ${active.height}` }}
      >
        <Image
          src={active.url}
          alt={active.altText ?? productTitle}
          fill
          sizes="(max-width: 767px) 100vw, 1px"
          quality={90}
          className="object-contain transition-opacity duration-300"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 px-6 py-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`relative aspect-square w-16 overflow-hidden bg-proton-light border-b-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2 ${
                i === activeIndex ? 'border-proton-black' : 'border-transparent hover:border-proton-grey'
              }`}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === activeIndex}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${productTitle} image ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
