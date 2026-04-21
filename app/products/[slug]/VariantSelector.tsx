'use client'

import { useMemo, useState } from 'react'
import type { ProductVariant } from '@/types/product'
import Button from '@/components/ui/Button'
import { useCartStore } from '@/stores/cart'

interface VariantSelectorProps {
  variants: ProductVariant[]
  productTitle: string
  productHandle: string
  productImage?: string
}

export default function VariantSelector({ variants, productTitle, productHandle, productImage }: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    variants.find(v => v.availableForSale)?.id ?? null
  )
  const [note, setNote] = useState<string | null>(null)
  const { addItem, openCart, items } = useCartStore()

  const selected = variants.find(v => v.id === selectedId)

  const alreadyInCart = useMemo(() => {
    if (!selected) return 0
    const sizeLabel = selected.selectedOptions.find(o => o.name === 'Size')?.value ?? selected.title
    const id = `protonlab-${productHandle}-${sizeLabel}`
    return items.find(i => i.id === id)?.quantity ?? 0
  }, [items, selected, productHandle])

  const remaining = selected?.quantity !== undefined
    ? Math.max(0, selected.quantity - alreadyInCart)
    : undefined

  function handleAddToCart() {
    if (!selected?.availableForSale) return
    const sizeLabel = selected.selectedOptions.find(o => o.name === 'Size')?.value ?? selected.title
    const result = addItem({
      clubHandle: 'protonlab',
      clubName: 'Proton Lab',
      productHandle,
      productName: productTitle,
      size: sizeLabel,
      price: selected.price.amount,
      maxQuantity: selected.quantity,
      image: productImage,
    })
    if (!result.ok) {
      setNote(
        result.reason === 'out-of-stock'
          ? 'This size is out of stock.'
          : `Only ${selected.quantity} available — already in your cart.`
      )
      return
    }
    setNote(null)
    openCart()
  }

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
        {selected?.availableForSale && remaining !== undefined && remaining > 0 && remaining <= 3 && (
          <p className="mt-3 text-[11px] uppercase tracking-widest text-proton-grey">
            Only {remaining} left
          </p>
        )}
      </div>

      {/* Add to cart */}
      <div className="pt-2 space-y-2">
        <Button
          variant="primary"
          size="lg"
          disabled={!selected?.availableForSale || remaining === 0}
          className="w-full justify-center"
          onClick={handleAddToCart}
        >
          {!selected || !selected.availableForSale
            ? 'Sold Out'
            : remaining === 0
            ? 'Max in cart'
            : 'Add to Cart'}
        </Button>
        {note && <p role="alert" className="text-[11px] text-red-600">{note}</p>}
      </div>
    </div>
  )
}
