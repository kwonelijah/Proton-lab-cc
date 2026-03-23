'use client'

import { useState } from 'react'
import type { ProductVariant } from '@/types/product'
import Button from '@/components/ui/Button'

interface VariantSelectorProps {
  variants: ProductVariant[]
  productTitle: string
}

export default function VariantSelector({ variants, productTitle }: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    variants.find(v => v.availableForSale)?.id ?? null
  )

  const selected = variants.find(v => v.id === selectedId)

  return (
    <div className="space-y-6">
      {/* Size selector */}
      <div>
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-proton-grey">Size</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map(variant => {
            const isSelected = variant.id === selectedId
            const sizeLabel = variant.selectedOptions.find(o => o.name === 'Size')?.value ?? variant.title

            return (
              <button
                key={variant.id}
                onClick={() => variant.availableForSale && setSelectedId(variant.id)}
                disabled={!variant.availableForSale}
                className={`min-w-[3rem] h-11 px-3 border text-xs uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'bg-proton-black text-proton-white border-proton-black'
                    : variant.availableForSale
                    ? 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
                    : 'bg-transparent text-proton-grey border-proton-light cursor-not-allowed relative overflow-hidden'
                }`}
                aria-label={`Size ${sizeLabel}${!variant.availableForSale ? ', sold out' : ''}`}
              >
                {/* Strikethrough for sold out */}
                {!variant.availableForSale && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="absolute w-full h-px bg-proton-mid rotate-45" />
                  </span>
                )}
                {sizeLabel}
              </button>
            )
          })}
        </div>
      </div>

      {/* Add to cart */}
      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          disabled={!selected?.availableForSale}
          className="w-full justify-center"
          onClick={() => {
            // TODO: add to cart via Zustand store
            // cartStore.addItem({ variantId: selected!.id, productTitle })
          }}
        >
          {!selected || !selected.availableForSale ? 'Sold Out' : 'Add to Cart — Coming Soon'}
        </Button>
        {selected?.availableForSale && (
          <p className="text-[10px] text-proton-grey text-center mt-3 uppercase tracking-widest">
            Checkout via Shopify — launching soon
          </p>
        )}
      </div>
    </div>
  )
}
