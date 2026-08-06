'use client'

import { useEffect, useState } from 'react'
import { useCurrencyStore } from '@/stores/region'

// Footer line explaining the geo-driven display currency. There is no user
// switcher — the charged currency is bound to the delivery region picked in
// the cart. Mounted-gate avoids a hydration mismatch (server pass doesn't
// know the cookie).
export default function CurrencyNote() {
  const currency = useCurrencyStore(s => s.currency)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const label = currency === 'EUR' ? 'EUR (€)' : 'GBP (£)'
  return (
    <p className="text-[10px] text-proton-white/40 uppercase tracking-widest">
      Prices shown in {label} based on your location · Delivery region is selected in the cart
    </p>
  )
}
