'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrencyStore } from '@/stores/region'

// Short delivery & customs line for product pages. Rates live in
// protonlab-backend/config/shipping.js — keep this in sync with /delivery.
// Currency follows the visitor's £/€ setting; mounted-gate avoids a
// hydration mismatch since the server pass doesn't know the cookie.
export default function DeliveryNote() {
  const currency = useCurrencyStore(s => s.currency)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const copy = mounted && currency === 'EUR'
    ? 'UK & Ireland delivery from €3.49 — free over €150. Europe €6.99 — duties & customs covered.'
    : 'UK & Ireland delivery from £2.99 — free over £110. Europe £5.99 — duties & customs covered.'

  return (
    <p className="text-xs text-proton-grey leading-relaxed">
      {copy}{' '}
      <Link
        href="/delivery"
        className="underline underline-offset-2 hover:text-proton-black transition-colors duration-200"
      >
        Delivery details
      </Link>
    </p>
  )
}
