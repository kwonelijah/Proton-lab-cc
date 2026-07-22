'use client'

import { useEffect, useState } from 'react'
import type { ProductVariant } from '@/types/product'
import Button from '@/components/ui/Button'
import { useCartStore } from '@/stores/cart'
import { trackMetaEvent, parsePrice } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'

interface Props {
  variants: ProductVariant[]
  productHandle: string
  productName: string
  clubHandle: string
  clubName: string
  price: string
}

export default function ClubVariantSelector({ variants, productHandle, productName, clubHandle, clubName, price }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(variants[0]?.id ?? null)
  const [added, setAdded] = useState(false)
  const { addItem, openCart } = useCartStore()

  const selected = variants.find(v => v.id === selectedId)
  const sizeLabel = selected?.selectedOptions.find(o => o.name === 'Size')?.value ?? selected?.title ?? ''

  // Meta Pixel: club product page viewed
  useEffect(() => {
    trackMetaEvent('ViewContent', {
      content_ids: [productHandle],
      content_name: `${clubName} — ${productName}`,
      content_type: 'product',
      content_category: 'club-shop',
      currency: 'GBP',
      value: parsePrice(price),
    })
    trackGaEvent('view_item', {
      currency: 'GBP',
      value: parsePrice(price),
      items: [
        {
          item_id: productHandle,
          item_name: `${clubName} — ${productName}`,
          item_category: 'club-shop',
          price: parsePrice(price),
          quantity: 1,
        },
      ],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productHandle])

  function handleAddToCart() {
    if (!selected) return
    addItem({ clubHandle, clubName, productHandle, productName, size: sizeLabel, price })
    trackMetaEvent('AddToCart', {
      content_ids: [productHandle],
      content_name: `${clubName} — ${productName}`,
      content_type: 'product',
      content_category: 'club-shop',
      currency: 'GBP',
      value: parsePrice(price),
    })
    trackGaEvent('add_to_cart', {
      currency: 'GBP',
      value: parsePrice(price),
      items: [
        {
          item_id: productHandle,
          item_name: `${clubName} — ${productName}`,
          item_category: 'club-shop',
          price: parsePrice(price),
          quantity: 1,
        },
      ],
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Size selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-3">Size</p>
        <div className="flex flex-wrap gap-2">
          {variants.map(variant => {
            const isSelected = variant.id === selectedId
            const label = variant.selectedOptions.find(o => o.name === 'Size')?.value ?? variant.title
            return (
              <button
                key={variant.id}
                onClick={() => { setSelectedId(variant.id); setAdded(false) }}
                className={`min-w-[3rem] h-11 px-3 border text-xs uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'bg-proton-black text-proton-white border-proton-black'
                    : 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          onClick={handleAddToCart}
          disabled={!selected}
        >
          {added ? 'Added to Cart' : 'Add to Cart'}
        </Button>

        {added && (
          <button
            onClick={openCart}
            className="w-full text-center text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200"
          >
            View Cart
          </button>
        )}
      </div>
    </div>
  )
}
