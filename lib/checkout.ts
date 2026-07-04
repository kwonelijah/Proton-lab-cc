const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://protonlab-backend.vercel.app'

export interface CheckoutItem {
  handle: string
  size: string
  quantity: number
  image?: string
  clubName?: string
}

export type ShippingRegion = 'uk' | 'europe' | 'world'

export async function redirectToCheckout(
  items: CheckoutItem[],
  shippingRegion: ShippingRegion = 'uk'
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, shippingRegion }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error)
  if (!data.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}
