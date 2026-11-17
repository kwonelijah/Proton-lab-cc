'use client'

import ProductCard from '@/components/ui/ProductCard'
import type { Product } from '@/types/product'

interface HomeCollectionCarouselProps {
  products: Product[]
  label?: string
}

// Marquee of the live collection straight under the full-screen hero — no
// heading band. Same cards and hairline black dividers as /shop: zero
// gutters, 4 across on desktop, 2 on phones. Hover pauses the scroll.
export default function HomeCollectionCarousel({
  products,
  label = 'Summer 2026',
}: HomeCollectionCarouselProps) {
  if (products.length === 0) return null

  // Two copies of the list so the marquee (translateX -50%) loops seamlessly;
  // the second copy is decorative for assistive tech and keyboard users.
  const loop = [...products, ...products]

  return (
    <section aria-label={`${label} collection`} className="border-b border-proton-black">
      {/* group enables hover-to-pause; overflow hides the off-screen copies */}
      <div className="group relative overflow-hidden">
        <ul className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          {loop.map((product, i) => (
            <li
              key={`${product.id}-${i}`}
              className="w-[50vw] md:w-[25vw] shrink-0 border-r border-proton-black"
            >
              <ProductCard product={product} variant="shop" decorative={i >= products.length} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
