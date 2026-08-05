'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrencyStore } from '@/stores/region'
import type { Currency } from '@/lib/currency'

// £/€ display-currency switcher. Server components read the cookie, so a
// flip must refresh the tree; rendering is gated on mount because the server
// pass doesn't know the cookie value.
export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrencyStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function flip(next: Currency) {
    if (next === currency) return
    setCurrency(next)
    router.refresh()
  }

  if (!mounted) return <span className="inline-block w-9" aria-hidden="true" />

  return (
    <span className="flex items-center font-inter text-xs" aria-label="Currency">
      <button
        onClick={() => flip('GBP')}
        aria-pressed={currency === 'GBP'}
        className={`px-1 py-2 transition-opacity duration-200 ${currency === 'GBP' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
      >
        £
      </button>
      <span aria-hidden="true" className="opacity-30">/</span>
      <button
        onClick={() => flip('EUR')}
        aria-pressed={currency === 'EUR'}
        className={`px-1 py-2 transition-opacity duration-200 ${currency === 'EUR' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
      >
        €
      </button>
    </span>
  )
}
