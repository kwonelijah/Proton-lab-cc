'use client'

import { useEffect, useState } from 'react'
import { getConsent, setConsent } from '@/lib/meta'

// Minimal cookie consent bar. Shown once until the visitor chooses; the choice
// is stored in localStorage. Accepting initialises the Meta Pixel (MetaPixel.tsx
// listens for the consent event) — declining means no marketing cookies are set.

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  // Read localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setVisible(getConsent() === null)
  }, [])

  if (!visible) return null

  function choose(value: 'granted' | 'denied') {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[60] bg-proton-white border-t border-proton-light"
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-xs text-proton-grey leading-relaxed">
          We use cookies to measure how visitors find and use our site, including
          the performance of our ads. Declining means only essential cookies are set.
        </p>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => choose('denied')}
            className="text-[10px] uppercase tracking-widest text-proton-grey underline underline-offset-4 hover:text-proton-black transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
          >
            Decline
          </button>
          <button
            onClick={() => choose('granted')}
            className="bg-proton-black text-proton-white text-[10px] uppercase tracking-widest px-6 py-3 transition-all duration-300 hover:bg-proton-grey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
