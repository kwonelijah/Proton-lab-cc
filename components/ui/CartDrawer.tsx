'use client'

import { useState, useEffect } from 'react'
import { useCartStore } from '@/stores/cart'

const inputClasses =
  'w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-3 outline-none focus:border-proton-black transition-colors duration-200 placeholder:text-proton-grey'

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, clearCart } = useCartStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  async function handleOrder() {
    if (!name || !email || items.length === 0) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/club-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, items }),
    })

    setLoading(false)
    if (res.ok) {
      setSubmitted(true)
      clearCart()
    } else {
      setError('Something went wrong. Please try again or email us directly.')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-proton-black/40 z-50 transition-opacity duration-300"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-proton-white z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-proton-light">
          <p className="text-[10px] uppercase tracking-widest text-proton-black">Your Cart</p>
          <button
            onClick={closeCart}
            className="p-1 hover:opacity-60 transition-opacity duration-200"
            aria-label="Close cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="font-playfair text-3xl text-proton-black mb-3">Order received.</p>
            <p className="text-sm text-proton-grey leading-relaxed">
              We&apos;ll be in touch shortly to confirm and arrange payment.
            </p>
            <button
              onClick={() => { setSubmitted(false); setName(''); setEmail(''); setPhone(''); closeCart() }}
              className="mt-8 text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200"
            >
              Continue Shopping
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-proton-grey">Your cart is empty.</p>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {items.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-4 pb-5 border-b border-proton-light last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-1">{item.clubName}</p>
                    <p className="text-sm text-proton-black font-inter">{item.productName}</p>
                    <p className="text-xs text-proton-grey mt-1">
                      Size: {item.size}
                      {item.quantity > 1 && <span className="ml-2">× {item.quantity}</span>}
                    </p>
                    <p className="text-sm text-proton-black mt-1">{item.price}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-proton-grey hover:text-proton-black transition-colors duration-200 shrink-0 pt-1"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout form */}
            <div className="px-6 py-6 border-t border-proton-light space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-proton-grey">Your Details</p>
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
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className={inputClasses}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleOrder}
                disabled={!name || !email || loading}
                className="w-full bg-proton-black text-proton-white text-xs uppercase tracking-widest py-4 font-inter transition-all duration-300 hover:bg-proton-grey disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Placing Order…' : 'Place Order'}
              </button>
              <p className="text-[10px] text-proton-grey text-center">
                We&apos;ll confirm your order and arrange payment by email.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
