'use client'

import { useState } from 'react'
import type { ProductVariant } from '@/types/product'
import Button from '@/components/ui/Button'

interface Props {
  variants: ProductVariant[]
  productName: string
  clubName: string
  price: string
}

const inputClasses =
  'w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-3 outline-none focus:border-proton-black transition-colors duration-200 placeholder:text-proton-grey'

export default function ClubVariantSelector({ variants, productName, clubName, price }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(variants[0]?.id ?? null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = variants.find(v => v.id === selectedId)
  const sizeLabel = selected?.selectedOptions.find(o => o.name === 'Size')?.value ?? selected?.title

  async function handleOrder() {
    if (!selected || !name || !email) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/club-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, size: sizeLabel, productName, clubName, price }),
    })

    setLoading(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      setError('Something went wrong. Please try again or email us directly.')
    }
  }

  if (submitted) {
    return (
      <div className="py-6">
        <p className="font-playfair text-2xl text-proton-black mb-3">Order received.</p>
        <p className="text-sm text-proton-grey">We&apos;ll be in touch shortly to confirm your order and arrange payment.</p>
      </div>
    )
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
                onClick={() => setSelectedId(variant.id)}
                className={`min-w-[3rem] h-10 px-3 border text-xs uppercase tracking-widest transition-all duration-200 ${
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

      {!showForm ? (
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          onClick={() => setShowForm(true)}
          disabled={!selected}
        >
          Order Now
        </Button>
      ) : (
        <div className="space-y-5 pt-2 border-t border-proton-light">
          <p className="text-[10px] uppercase tracking-widest text-proton-grey pt-4">Your Details</p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClasses}
          />
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClasses}
          />
          <p className="text-xs text-proton-grey">
            Ordering: <span className="text-proton-black">{productName}</span>
            {' — '}Size <span className="text-proton-black">{sizeLabel}</span>
            {' — '}{price}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center"
            onClick={handleOrder}
            disabled={!name || !email || loading}
          >
            {loading ? 'Placing Order…' : 'Place Order'}
          </Button>
        </div>
      )}
    </div>
  )
}
