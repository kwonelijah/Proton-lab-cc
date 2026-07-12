// Meta (Facebook) Pixel helpers — cookie consent state + typed fbq wrappers.
// The pixel itself is loaded by components/analytics/MetaPixel.tsx, and only
// after the visitor accepts cookies (components/analytics/ConsentBanner.tsx).
// Server-side Purchase events are sent independently by protonlab-backend
// (lib/meta-capi.js) and deduplicated against the browser event via eventID.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''

// ─── Consent ──────────────────────────────────────────────────────────────────

export type ConsentState = 'granted' | 'denied' | null

const CONSENT_KEY = 'pl-cookie-consent'
export const CONSENT_EVENT = 'pl-consent-change'

export function getConsent(): ConsentState {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'granted' || value === 'denied' ? value : null
}

export function setConsent(value: 'granted' | 'denied'): void {
  window.localStorage.setItem(CONSENT_KEY, value)
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

// ─── Event tracking ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export type MetaEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

export interface MetaEventParams {
  value?: number
  currency?: string
  content_ids?: string[]
  content_name?: string
  content_type?: 'product'
  contents?: { id: string; quantity: number }[]
  num_items?: number
}

// No-ops until the pixel has been initialised (i.e. before consent).
export function trackMetaEvent(event: MetaEventName, params: MetaEventParams, eventId?: string): void {
  if (typeof window === 'undefined' || !window.fbq) return
  if (eventId) {
    window.fbq('track', event, params, { eventID: eventId })
  } else {
    window.fbq('track', event, params)
  }
}

// Prices in the cart store are GBP strings that may carry a £ sign.
export function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0
}

// ─── Attribution cookies for the Conversions API ──────────────────────────────

// _fbp/_fbc are set by the pixel; they're forwarded to the backend at checkout
// so the server-side Purchase event carries the same attribution signals.
export function getFbCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {}
  const read = (name: string) =>
    document.cookie
      .split('; ')
      .find(c => c.startsWith(name + '='))
      ?.substring(name.length + 1)
  const fbp = read('_fbp')
  let fbc = read('_fbc')
  // Visitor landed from an ad (?fbclid=) but the pixel hasn't written _fbc —
  // derive it in Meta's documented format so the click is still attributed.
  if (!fbc) {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid')
    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`
  }
  return { fbp, fbc }
}
