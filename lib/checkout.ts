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

// Thrown when the backend refuses or fails to create a session. `userFacing`
// is true for 4xx responses — validation the customer can act on (too many
// different items, unknown product) — so the cart can show the message as is.
export class CheckoutError extends Error {
  status: number
  userFacing: boolean
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CheckoutError'
    this.status = status
    this.userFacing = status >= 400 && status < 500
  }
}

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

  const data = await res.json().catch(() => ({}))
  if (data.error) throw new CheckoutError(data.error, res.status)
  if (!data.url) throw new CheckoutError('No checkout URL returned', res.status)

  window.location.href = data.url
}
