// Meta (Facebook) Pixel helpers — typed fbq wrappers. The pixel itself is
// loaded by components/analytics/MetaPixel.tsx on first mount. Server-side
// Purchase events are sent independently by protonlab-backend
// (lib/meta-capi.js) and deduplicated against the browser event via eventID.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''

// ─── Event tracking ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export type MetaEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Lead'

export interface MetaEventParams {
  value?: number
  currency?: string
  content_ids?: string[]
  content_name?: string
  content_type?: 'product'
  contents?: { id: string; quantity: number }[]
  num_items?: number
}

// Events fired before the pixel is initialised are queued and flushed by
// MetaPixel.tsx right after init. This matters on direct page loads (e.g. an
// ad click landing on a product page): the page's ViewContent effect runs
// before the pixel loader's effect, and without the queue the event is lost.
let pixelReady = false
const pendingEvents: Array<[MetaEventName, MetaEventParams, string | undefined]> = []

function sendEvent(event: MetaEventName, params: MetaEventParams, eventId?: string): void {
  if (!window.fbq) return
  if (eventId) {
    window.fbq('track', event, params, { eventID: eventId })
  } else {
    window.fbq('track', event, params)
  }
}

export function trackMetaEvent(event: MetaEventName, params: MetaEventParams, eventId?: string): void {
  if (typeof window === 'undefined') return
  if (!pixelReady || !window.fbq) {
    if (pendingEvents.length < 20) pendingEvents.push([event, params, eventId])
    return
  }
  sendEvent(event, params, eventId)
}

// Called by MetaPixel.tsx once fbq('init') has run.
export function markPixelReady(): void {
  pixelReady = true
  for (const [event, params, eventId] of pendingEvents.splice(0)) {
    sendEvent(event, params, eventId)
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
