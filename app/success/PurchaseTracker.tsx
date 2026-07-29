'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BACKEND_URL } from '@/lib/checkout'
import { trackMetaEvent } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'

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
        // Full line items from the backend; fall back to bare handles for
        // orders fetched from a backend deployed before `items` existed.
        type OrderItem = { id: string; name?: string; quantity?: number; price?: number }
        const items: OrderItem[] =
          order.items?.length
            ? order.items
            : (order.contentIds ?? []).map((id: string) => ({ id }))
        trackMetaEvent(
          'Purchase',
          {
            value: order.value,
            currency: order.currency,
            content_ids: items.map(i => i.id),
            contents: items.map(i => ({ id: i.id, quantity: i.quantity ?? 1 })),
            content_type: 'product',
            content_category: order.channel,
            num_items: order.numItems,
          },
          sessionId
        )
        // GA4 also dedupes on transaction_id, on top of the sessionStorage
        // guard. item_name is what the default e-commerce reports key on —
        // without it purchases land under "(not set)".
        trackGaEvent('purchase', {
          transaction_id: sessionId,
          value: order.value,
          currency: order.currency,
          items: items.map(i => ({
            item_id: i.id,
            item_name: i.name,
            item_category: order.channel,
            price: i.price,
            quantity: i.quantity ?? 1,
          })),
        })
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
