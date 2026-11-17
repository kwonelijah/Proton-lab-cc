'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Product } from '@/types/product'
import ProductCard, { CARD_LABEL } from '@/components/ui/ProductCard'
import ShopFilter from './ShopFilter'
import { ALL_CATEGORY, availableCategories, matchesCategory } from '@/lib/shop-categories'

// Hairline black dividers: a top border on the grid, a bottom border on every cell and
// a right border on every cell except the last column (2 columns on phones,
// 4 from md up). Cells touch, so the borders are the only separation.
const CELL =
  'border-b border-proton-black [&:not(:nth-child(2n))]:border-r md:[&:not(:nth-child(4n))]:border-r'

interface ShopCollectionProps {
  products: Product[]
  heading: ReactNode
}

// Slim bar (inside the page container: just the FILTER control on the right;
// the page title is visually hidden) followed by the product grid. The grid is a sibling of the container, not a
// child, so it spans <main> edge to edge with zero column gap: 4 columns on
// desktop, 2 on phones, cards touching. Filtering is plain client state — no
// URL params, so the server render (category "all") matches the first client
// render exactly.
export default function ShopCollection({ products, heading }: ShopCollectionProps) {
  const [category, setCategory] = useState(ALL_CATEGORY)
  const categories = availableCategories(products)
  const visible = products.filter(p => matchesCategory(p, category))

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-1 md:py-2">
        <div className="flex items-center justify-end gap-6">
          {heading}
          {categories.length > 0 && (
            <ShopFilter categories={categories} value={category} onChange={setCategory} />
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'product' : 'products'}
      </p>

      {products.length === 0 ? null : visible.length > 0 ? (
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-proton-black pb-10 md:pb-14">
          {visible.map((product, i) => (
            <li key={product.id} className={CELL}>
              <ProductCard product={product} variant="shop" priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={`max-w-7xl mx-auto px-6 md:px-12 pb-24 ${CARD_LABEL} text-proton-grey`}>
          Nothing in this category right now.
        </p>
      )}
    </>
  )
}
