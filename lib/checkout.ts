import { getFbCookies } from '@/lib/meta'
import { getGaCookies } from '@/lib/ga'

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://protonlab-backend.vercel.app'

export interface CheckoutItem {
  handle: string
  size: string
  quantity: number
  image?: string
  clubName?: string
  clubHandle?: string // keys the server-side club price override; retail sends 'protonlab'
}

// The delivery region decides the charged currency server-side (uk → GBP,
// ireland/europe → EUR) — no currency field is sent; the backend would
// ignore it anyway.
export type ShippingRegion = 'uk' | 'ireland' | 'europe'

export async function redirectToCheckout(
  items: CheckoutItem[],
  shippingRegion: ShippingRegion = 'uk'
): Promise<void> {
  // Meta attribution cookies ride along so the backend can stamp them onto the
  // PaymentIntent and send a fully-attributed Conversions API Purchase event.
  // GA cookies do the same for the server-side GA4 Measurement Protocol
  // purchase — same client_id as this browser, so GA4 dedups the pair.
  const { fbp, fbc } = getFbCookies()
  const { gaClientId, gaSessionId } = getGaCookies()

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, shippingRegion, fbp, fbc, gaClientId, gaSessionId }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error)
  if (!data.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}
