'use client'

import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '@/stores/cart'
import { redirectToCheckout } from '@/lib/checkout'

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Prevent body scroll when drawer is open (with scrollbar compensation)
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  // Save focus position, move focus into drawer on open, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])'
      )
      focusable?.[0]?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Focus trap + Escape to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeCart(); return }
      if (e.key !== 'Tab') return
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeCart])

  async function handleCheckout() {
    if (items.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const toAmount = (p: string) => parseFloat(p.replace(/[^0-9.]/g, ''))
      await redirectToCheckout(
        items.map(item => ({
          name: item.productName,
          description: `Size: ${item.size}`,
          price: Math.round(toAmount(item.price) * 100),
          quantity: item.quantity,
          image: item.image,
        }))
      )
    } catch {
      setLoading(false)
      setError('Could not connect to payment server. Please try again.')
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
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-proton-white z-50 flex flex-col shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-proton-light">
          <p className="text-[10px] uppercase tracking-widest text-proton-black">Your Cart</p>
          <button
            onClick={closeCart}
            className="p-3 -mr-2 hover:opacity-60 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
            aria-label="Close cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
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

            {/* Checkout footer */}
            <div className="px-6 py-6 border-t border-proton-light space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-proton-grey">Total</p>
                <p className="text-sm text-proton-black">
                  £{items.reduce((sum, i) => sum + parseFloat(i.price.replace(/[^0-9.]/g, '')) * i.quantity, 0).toFixed(2)}
                </p>
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-proton-black text-proton-white text-xs uppercase tracking-widest py-4 font-inter transition-all duration-300 hover:bg-proton-grey disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
              >
                {loading ? 'Redirecting…' : 'Checkout'}
              </button>
              <p className="text-[10px] text-proton-grey text-center">
                Secure checkout via Stripe
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
