'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { subscribeToNewsletter } from '@/lib/newsletter'

// Newsletter capture popup. Shows once per visitor, 10 s after landing —
// dismissing or subscribing writes a localStorage flag and it never returns.
// Follows the CartDrawer overlay conventions (backdrop, Escape, dialog role).

const STORAGE_KEY = 'pl_newsletter'
const SHOW_DELAY_MS = 10_000

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
    const timer = setTimeout(() => {
      // Don't interrupt someone mid-purchase or on the order success page.
      if (!window.location.pathname.startsWith('/success')) setIsOpen(true)
    }, SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Escape to close + focus the field when it opens
  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-proton-black/40 z-50 transition-opacity duration-300"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Newsletter signup"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-3rem)] max-w-md bg-proton-white shadow-2xl p-8 md:p-10"
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
          <div className="text-center py-4">
            <h2 className="font-playfair text-3xl leading-tight mb-4">
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
            <h2 className="font-playfair text-3xl leading-tight mb-3">Get 10% off your first order</h2>
            <p className="text-sm text-proton-grey leading-relaxed mb-6">
              Join the list and we’ll email you a single-use code for 10% off
              your first order.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
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
                className="w-full border border-proton-mid bg-transparent px-4 py-3 text-sm text-proton-black placeholder:text-proton-grey focus:outline-none focus:border-proton-black transition-colors duration-200"
              />
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-proton-black text-proton-white text-xs uppercase tracking-widest py-4 font-inter transition-all duration-300 hover:bg-proton-grey disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
              >
                {status === 'sending' ? 'Signing up…' : 'Get my code'}
              </button>
            </form>

            <p className="text-[10px] text-proton-grey leading-relaxed mt-4">
              By signing up you agree to receive marketing emails from Proton
              Lab. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </>
  )
}
