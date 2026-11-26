'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product } from '@/types/product'
import ProductCard, { CARD_LABEL } from '@/components/ui/ProductCard'

interface OtherProductsProps {
  // Already ordered by the page: jersey, shorts, jersey, shorts, then the rest.
  products: Product[]
}

// "Other Products" under a product: one full-bleed row of the shop cards with
// the shop's black hairlines, 4 across on desktop and 2 on phones. The row
// sits still; the small arrow on its right edge slides it along one product
// at a time and returns to the start from the end. Phones can also swipe.
// The arrow is only offered when there are more products than fit. The track
// is `relative` so the cards' sr-only text scrolls with it instead of
// widening the page.
export default function OtherProducts({ products }: OtherProductsProps) {
  const track = useRef<HTMLUListElement>(null)
  const [canSlide, setCanSlide] = useState(false)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => setCanSlide(el.scrollWidth - el.clientWidth > 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [products.length])

  const next = useCallback(() => {
    const el = track.current
    if (!el) return
    const card = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      left: atEnd ? 0 : el.scrollLeft + card,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [])

  if (products.length === 0) return null

  return (
    <section aria-label="Other products">
      <h2 className={`${CARD_LABEL} text-center text-proton-black py-4`}>Other Products</h2>
      <div className="relative border-t border-proton-black">
        <ul
          ref={track}
          className="relative flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map(p => (
            <li
              key={p.id}
              className="w-1/2 md:w-1/4 shrink-0 snap-start border-b border-r border-proton-black"
            >
              <ProductCard product={p} variant="shop" />
            </li>
          ))}
        </ul>
        {canSlide && (
          // Centred on the 4:5 photo: half of (card width × 5/4), with the card
          // 50vw wide on phones and 25vw from md.
          <button
            type="button"
            onClick={next}
            aria-label="More products"
            className="absolute right-0 top-[31.25vw] md:top-[15.625vw] -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center bg-proton-white border border-r-0 border-proton-black text-proton-black"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
              <path d="M2 1l6 6-6 6" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
        )}
      </div>
    </section>
  )
}
