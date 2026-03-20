'use client'

import { useState } from 'react'
import ProductCard from '@/components/ui/ProductCard'
import type { Product } from '@/types/product'

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Jerseys', value: 'jersey' },
  { label: 'Shorts', value: 'shorts' },
  { label: 'Outerwear', value: 'outerwear' },
  { label: 'Skinsuits', value: 'skinsuit' },
  { label: 'Accessories', value: 'accessories' },
]

const tagMap: Record<string, string[]> = {
  jersey:      ['jersey'],
  shorts:      ['shorts', 'tights', 'bib'],
  outerwear:   ['jacket', 'gilet'],
  skinsuit:    ['skinsuit', 'trisuit'],
  accessories: ['accessories', 'socks', 'mitts', 'arm-warmers', 'knee-warmers', 'leg-warmers', 'headwear'],
}

interface ShopGridProps {
  products: Product[]
}

export default function ShopGrid({ products }: ShopGridProps) {
  const [active, setActive] = useState('all')

  const filtered = active === 'all'
    ? products
    : products.filter(p =>
        p.tags.some(tag =>
          tagMap[active]?.some(keyword => tag.includes(keyword))
        )
      )

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-12">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setActive(f.value)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-inter border transition-all duration-200 ${
              active === f.value
                ? 'bg-proton-black text-proton-white border-proton-black'
                : 'bg-transparent text-proton-grey border-proton-mid hover:border-proton-black hover:text-proton-black'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12">
          {filtered.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-proton-grey text-sm">No items in this category yet.</p>
        </div>
      )}
    </div>
  )
}
