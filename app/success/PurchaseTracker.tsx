'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BACKEND_URL } from '@/lib/checkout'
import { trackMetaEvent } from '@/lib/meta'

// Fires the browser-side Meta Purchase event when the customer lands back from
// Stripe. The order total is fetched from the backend (the client never knew
// the final amount — shipping/discounts are applied on the hosted page).
// eventID = the Stripe session id, matching the server-side Conversions API
// Purchase sent by protonlab-backend/api/webhook.js, so Meta deduplicates the
// pair instead of counting the sale twice.

export default function PurchaseTracker() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId || !sessionId.startsWith('cs_')) return

    // Refreshing /success must not re-fire the event
    const guardKey = `pl-purchase-${sessionId}`
    if (sessionStorage.getItem(guardKey)) return

    let cancelled = false
    fetch(`${BACKEND_URL}/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(order => {
        if (cancelled || !order) return
        trackMetaEvent(
          'Purchase',
          {
            value: order.value,
            currency: order.currency,
            content_ids: order.contentIds,
            content_type: 'product',
            content_category: order.channel,
            num_items: order.numItems,
          },
          sessionId
        )
        sessionStorage.setItem(guardKey, '1')
      })
      .catch(() => {
        // Browser event is best-effort — the server-side CAPI event still records the sale
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return null
}
