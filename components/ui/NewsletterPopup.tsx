'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { subscribeToNewsletter } from '@/lib/newsletter'

// Newsletter capture popup. Shows once per visitor when they scroll half way
// down the page — dismissing or subscribing writes a localStorage flag and it
// never returns. Desktop: centered dialog with backdrop (CartDrawer overlay
// conventions). Mobile: non-blocking bottom sheet capped at 30% of the screen.

const STORAGE_KEY = 'pl_newsletter'
const SCROLL_DEPTH = 0.5

export default function NewsletterPopup() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const onScroll = () => {
      const depth =
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight
      // Don't interrupt someone mid-purchase or on the order success page.
      if (depth >= SCROLL_DEPTH && !window.location.pathname.startsWith('/success')) {
        setIsOpen(true)
        window.removeEventListener('scroll', onScroll)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Browsers restore scroll position before React attaches the listener —
    // a reload mid-page would otherwise never trigger. Check once on mount.
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape to close; focus the field on desktop only — on mobile the sheet is
  // non-blocking and auto-focus would throw the keyboard over the page.
  useEffect(() => {
    if (!isOpen) return
    if (window.matchMedia('(min-width: 768px)').matches) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setIsOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setError(null)
    setStatus('sending')
    const result = await subscribeToNewsletter(email, 'popup', honeypot)
    if (!result.ok) {
      setStatus('idle')
      setError(result.error)
      return
    }
    localStorage.setItem(STORAGE_KEY, 'subscribed')
    setStatus(result.already ? 'already' : 'done')
  }

  if (!isOpen || pathname.startsWith('/success')) return null

  return (
    <>
      {/* Backdrop — desktop only; the mobile bottom sheet is non-blocking */}
      <div
        className="hidden md:block fixed inset-0 bg-proton-black/40 z-50 transition-opacity duration-300"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Dialog — centered card on desktop, bottom sheet (≤30% of screen) on mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Newsletter signup"
        className="fixed z-50 bg-proton-white shadow-2xl inset-x-0 bottom-0 min-h-[33vh] max-h-[40vh] overflow-y-auto p-6 border-t border-proton-light md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[calc(100%-3rem)] md:max-w-md md:min-h-0 md:max-h-none md:overflow-visible md:border-t-0 md:p-10"
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-proton-grey hover:text-proton-black transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {status === 'done' || status === 'already' ? (
          <div className="text-center py-2 md:py-4">
            <h2 className="font-playfair text-xl md:text-3xl leading-tight mb-2 md:mb-4">
              {status === 'already' ? 'You’re already on the list' : 'Check your inbox'}
            </h2>
            <p className="text-sm text-proton-grey leading-relaxed">
              {status === 'already'
                ? 'Your welcome code was sent when you first signed up.'
                : 'Your 10% code is on its way to your email.'}
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-playfair text-xl md:text-3xl leading-tight mb-2 md:mb-3 pr-8 md:pr-0">Get 10% off your first order</h2>
            <p className="text-xs md:text-sm text-proton-grey leading-relaxed mb-4 md:mb-6">
              Join the list and we’ll email you a single-use code for 10% off
              your first order.
            </p>

            <form onSubmit={handleSubmit} className="flex gap-2 md:block md:space-y-3">
              {/* Honeypot — humans never see this */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <input
                ref={inputRef}
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                aria-label="Email address"
                className="flex-1 min-w-0 md:w-full border border-proton-mid bg-transparent px-4 py-2.5 md:py-3 text-sm text-proton-black placeholder:text-proton-grey focus:outline-none focus:border-proton-black transition-colors duration-200"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="shrink-0 md:w-full bg-proton-black text-proton-white text-xs uppercase tracking-widest px-4 md:px-0 py-2.5 md:py-4 font-inter transition-all duration-300 hover:bg-proton-grey disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
              >
                {status === 'sending' ? 'Signing up…' : 'Get my code'}
              </button>
            </form>
            {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}

            <p className="text-[9px] md:text-[10px] text-proton-grey leading-relaxed mt-2 md:mt-4">
              By signing up you agree to receive marketing emails from Proton
              Lab. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </>
  )
}
