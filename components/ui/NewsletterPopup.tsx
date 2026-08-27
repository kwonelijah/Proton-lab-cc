'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { subscribeToNewsletter, type RidingType } from '@/lib/newsletter'
import { trackGaEvent } from '@/lib/ga'

// Newsletter capture popup, in two steps. Step one is a poll — "What types
// of riding do you do?", multi-select — with no offer attached;
// step two makes the 10% offer and takes the email. The poll answers ride
// along with the signup, where the backend files the contact into every
// matching riding-type audience (Road / Gravel / Tri & TT / Indoor / Other)
// alongside General.
//
// Shows once per visitor — dismissing or subscribing writes a localStorage
// flag and it never returns. Page-scoped: only the homepage, /shop and
// product pages trigger it, each with its own offer copy and desktop delay
// (the countdown restarts on navigation, so it measures time on the current
// page). Desktop: centered dialog with backdrop. Mobile: non-blocking bottom
// sheet capped at 40% of the screen, fired at half scroll depth or 15s,
// whichever comes first. The card is black — the one dark surface on an
// otherwise light site.

const STORAGE_KEY = 'pl_newsletter'
const SCROLL_DEPTH = 0.5
const MOBILE_DELAY_MS = 15000

const RIDING_OPTIONS: { key: RidingType; label: string }[] = [
  { key: 'road', label: 'Road' },
  { key: 'gravel', label: 'Gravel' },
  { key: 'triathlon', label: 'Triathlon' },
  { key: 'indoor', label: 'Indoor' },
  { key: 'other', label: 'Other' },
]

interface PopupCopy {
  headline: string
  sub: string
}

// Per-page trigger config for the OFFER step (the poll step is identical
// everywhere). Copy is resolved at fire time: product headlines read the page
// h1 (the product title), which avoids shipping the product catalogue to the
// client just for a title lookup.
function pagePopup(pathname: string): { delayMs: number; copy: () => PopupCopy } | null {
  if (pathname === '/') {
    return {
      delayMs: 8000,
      copy: () => ({
        headline: 'Want 10% off your first order?',
        sub: 'Join the mailing list to be first to hear about new releases, plus a discount code.',
      }),
    }
  }
  if (pathname === '/shop') {
    return {
      delayMs: 12000,
      copy: () => ({
        headline: 'Get 10% off your first order',
        sub: 'Join the mailing list and we’ll email you a single-use code to use at checkout.',
      }),
    }
  }
  if (pathname.startsWith('/products/')) {
    return {
      delayMs: 15000,
      copy: () => {
        const title = document.querySelector('main h1')?.textContent?.trim()
        return {
          headline: title ? `Like the look of the ${title}?` : 'Like what you see?',
          sub: 'Get 10% off your first order and join our mailing list.',
        }
      },
    }
  }
  return null
}

export default function NewsletterPopup() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'poll' | 'offer'>('poll')
  const [riding, setRiding] = useState<RidingType[]>([])
  const [ridingOther, setRidingOther] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copy, setCopy] = useState<PopupCopy | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen || localStorage.getItem(STORAGE_KEY)) return
    const config = pagePopup(pathname)
    if (!config) return

    let fired = false
    const open = () => {
      if (fired) return
      fired = true
      setCopy(config.copy())
      setIsOpen(true)
    }

    if (window.matchMedia('(min-width: 768px)').matches) {
      const timer = setTimeout(open, config.delayMs)
      return () => clearTimeout(timer)
    }

    // Mobile: half scroll depth or the flat fallback delay, first one wins.
    const timer = setTimeout(open, MOBILE_DELAY_MS)
    const onScroll = () => {
      const depth =
        (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight
      if (depth >= SCROLL_DEPTH) {
        open()
        window.removeEventListener('scroll', onScroll)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Browsers restore scroll position before React attaches the listener —
    // a reload mid-page would otherwise never trigger. Check once on mount.
    onScroll()
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname, isOpen])

  // Escape to close. Focus the email field when the offer step appears —
  // desktop only: on mobile the sheet is non-blocking and auto-focus would
  // throw the keyboard over the page.
  useEffect(() => {
    if (!isOpen) return
    if (step === 'offer' && window.matchMedia('(min-width: 768px)').matches) {
      inputRef.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setIsOpen(false)
  }

  function toggleRiding(choice: RidingType) {
    setRiding(prev =>
      prev.includes(choice) ? prev.filter(r => r !== choice) : [...prev, choice]
    )
  }

  function continueToOffer() {
    if (riding.length === 0) return
    setStep('offer')
    // Poll answers are worth counting even when no signup follows.
    trackGaEvent('newsletter_poll', { riding: riding.join(',') })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setError(null)
    setStatus('sending')
    const result = await subscribeToNewsletter(email, 'popup', honeypot, riding, ridingOther)
    if (!result.ok) {
      setStatus('idle')
      setError(result.error)
      return
    }
    localStorage.setItem(STORAGE_KEY, 'subscribed')
    setStatus(result.already ? 'already' : 'done')
  }

  if (!isOpen || !copy) return null

  return (
    <>
      {/* Backdrop — desktop only; the mobile bottom sheet is non-blocking */}
      <div
        className="hidden md:block fixed inset-0 bg-proton-black/40 z-50 transition-opacity duration-300"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Dialog — centered card on desktop, bottom sheet (≤40% of screen) on mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Newsletter signup"
        className="fixed z-50 bg-proton-black text-proton-white shadow-2xl inset-x-0 bottom-0 min-h-[33vh] max-h-[40vh] overflow-y-auto p-6 border-t border-proton-white/10 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[calc(100%-3rem)] md:max-w-md md:min-h-0 md:max-h-none md:overflow-visible md:border-t-0 md:p-10"
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-proton-white/50 hover:text-proton-white transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {status === 'done' || status === 'already' ? (
          <div className="text-center py-2 md:py-4">
            <h2 className="font-playfair text-xl md:text-3xl leading-tight mb-2 md:mb-4">
              {status === 'already' ? 'You’re already on the mailing list' : 'Check your inbox'}
            </h2>
            <p className="text-sm text-proton-white/60 leading-relaxed">
              {status === 'already'
                ? 'Your welcome code was sent when you first signed up.'
                : 'Your 10% code is on its way to your email.'}
            </p>
          </div>
        ) : step === 'poll' ? (
          <>
            <h2 className="font-playfair text-xl md:text-3xl leading-tight mb-4 md:mb-6 pr-8 md:pr-0">
              What types of riding do you do?
            </h2>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {RIDING_OPTIONS.map(opt => {
                const selected = riding.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleRiding(opt.key)}
                    aria-pressed={selected}
                    className={`border text-xs uppercase tracking-widest py-3 md:py-4 font-inter transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-proton-black ${
                      opt.key === 'other' ? 'col-span-2' : ''
                    } ${
                      selected
                        ? 'border-proton-white bg-proton-white text-proton-black'
                        : 'border-proton-white/30 bg-transparent text-proton-white hover:border-proton-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {riding.includes('other') && (
              <input
                type="text"
                value={ridingOther}
                onChange={e => setRidingOther(e.target.value)}
                maxLength={80}
                placeholder="What do you ride? (optional)"
                aria-label="What do you ride?"
                className="w-full mt-2 md:mt-3 border border-proton-white/30 bg-transparent px-4 py-2.5 md:py-3 text-sm text-proton-white placeholder:text-proton-white/40 focus:outline-none focus:border-proton-white transition-colors duration-200"
              />
            )}
            <button
              onClick={continueToOffer}
              disabled={riding.length === 0}
              className="w-full mt-3 md:mt-4 border border-proton-white bg-transparent text-proton-white text-xs uppercase tracking-widest py-3 md:py-4 font-inter transition-all duration-300 hover:bg-proton-white hover:text-proton-black disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-proton-black"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <h2 className="font-playfair text-xl md:text-3xl leading-tight mb-2 md:mb-3 pr-8 md:pr-0">{copy.headline}</h2>
            <p className="text-xs md:text-sm text-proton-white/60 leading-relaxed mb-4 md:mb-6">
              {copy.sub}
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
                className="flex-1 min-w-0 md:w-full bg-proton-white border border-proton-white px-4 py-2.5 md:py-3 text-sm text-proton-black placeholder:text-proton-grey focus:outline-none focus:ring-2 focus:ring-proton-white/50 focus:ring-offset-2 focus:ring-offset-proton-black transition-shadow duration-200"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="shrink-0 md:w-full border border-proton-white bg-transparent text-proton-white text-xs uppercase tracking-widest px-4 md:px-0 py-2.5 md:py-4 font-inter transition-all duration-300 hover:bg-proton-white hover:text-proton-black disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-proton-black"
              >
                {status === 'sending' ? 'Signing up…' : 'Get my code'}
              </button>
            </form>
            {error && <p role="alert" className="text-xs text-red-400 mt-2">{error}</p>}

            <p className="text-[9px] md:text-[10px] text-proton-white/40 leading-relaxed mt-2 md:mt-4">
              By signing up you agree to receive marketing emails from Proton
              Lab. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </>
  )
}
