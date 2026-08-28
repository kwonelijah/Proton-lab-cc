'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProductVariant } from '@/types/product'
import Button from '@/components/ui/Button'
import NotifyMe from './NotifyMe'
import { useCartStore } from '@/stores/cart'
import { trackMetaEvent, parsePrice } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'

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
  const selectedSizeLabel = selected
    ? selected.selectedOptions.find(o => o.name === 'Size')?.value ?? selected.title
    : ''

  // Meta Pixel: product page viewed. Currency rides with the variant data —
  // lib/api.ts already overlays EUR amounts for EUR visitors, so value and
  // currency can never disagree.
  useEffect(() => {
    const currency = variants[0]?.price.currencyCode ?? 'GBP'
    trackMetaEvent('ViewContent', {
      content_ids: [productHandle],
      content_name: productTitle,
      content_type: 'product',
      content_category: 'retail',
      currency,
      value: parsePrice(variants[0]?.price.amount ?? '0'),
    })
    trackGaEvent('view_item', {
      currency,
      value: parsePrice(variants[0]?.price.amount ?? '0'),
      items: [
        {
          item_id: productHandle,
          item_name: productTitle,
          item_category: 'retail',
          price: parsePrice(variants[0]?.price.amount ?? '0'),
          quantity: 1,
        },
      ],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productHandle])

  // Whole product gone → the size grid and Add to Cart are dead weight;
  // swap them for the back-in-stock capture instead. A single sold-out size
  // stays selectable in the grid and swaps only the Add to Cart button for
  // the same capture, fixed to that size (see below).
  const soldOut = variants.every(v => !v.availableForSale)
  const sizeLabels = useMemo(
    () => variants.map(v => v.selectedOptions.find(o => o.name === 'Size')?.value ?? v.title),
    [variants]
  )

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
    trackMetaEvent('AddToCart', {
      content_ids: [productHandle],
      content_name: productTitle,
      content_type: 'product',
      content_category: 'retail',
      currency: selected.price.currencyCode,
      value: parsePrice(selected.price.amount),
    })
    trackGaEvent('add_to_cart', {
      currency: selected.price.currencyCode,
      value: parsePrice(selected.price.amount),
      items: [
        {
          item_id: productHandle,
          item_name: productTitle,
          item_category: 'retail',
          price: parsePrice(selected.price.amount),
          quantity: 1,
        },
      ],
    })
    openCart()
  }

  if (soldOut) {
    return <NotifyMe productHandle={productHandle} sizes={sizeLabels} />
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
            const inStock = variant.availableForSale
            const sizeLabel = variant.selectedOptions.find(o => o.name === 'Size')?.value ?? variant.title

            return (
              <button
                key={variant.id}
                onClick={() => { setSelectedId(variant.id); setNote(null) }}
                aria-pressed={isSelected}
                className={`min-w-[3rem] h-11 px-3 border text-xs uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2 ${
                  isSelected && inStock
                    ? 'bg-proton-black text-proton-white border-proton-black'
                    : inStock
                    ? 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
                    : isSelected
                    ? 'bg-transparent text-proton-black border-proton-black relative overflow-hidden'
                    : 'bg-transparent text-proton-grey border-proton-light hover:border-proton-grey relative overflow-hidden'
                }`}
                aria-label={`Size ${sizeLabel}${!inStock ? ', sold out' : ''}`}
                title={!inStock ? "Sold out — select to be notified when it's back" : undefined}
              >
                {/* Strikethrough for sold out — still selectable, to request a restock notice */}
                {!inStock && (
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span className={`absolute w-full h-px rotate-45 ${isSelected ? 'bg-proton-black' : 'bg-proton-mid'}`} />
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

      {/* Add to cart — or, for a sold-out size, the restock notice form.
          Keyed by size so switching between sold-out sizes resets the form. */}
      {selected && !selected.availableForSale ? (
        <NotifyMe
          key={selectedSizeLabel}
          productHandle={productHandle}
          sizes={sizeLabels}
          size={selectedSizeLabel}
        />
      ) : (
        <div className="pt-2 space-y-2">
          <Button
            variant="primary"
            size="lg"
            disabled={!selected || remaining === 0}
            className="w-full justify-center"
            onClick={handleAddToCart}
          >
            {!selected ? 'Sold Out' : remaining === 0 ? 'Max in cart' : 'Add to Cart'}
          </Button>
          {note && <p role="alert" className="text-[11px] text-red-600">{note}</p>}
        </div>
      )}
    </div>
  )
}
