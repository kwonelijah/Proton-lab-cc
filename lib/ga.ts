// Google Analytics 4 helpers — typed gtag wrappers, the GA counterpart to
// lib/meta.ts. Whichever touches GA first (the GoogleAnalytics loader in the
// layout or an event call) creates the dataLayer stub, registers the config,
// and injects gtag.js. Commands pushed before the script arrives are replayed
// by gtag.js in order, so unlike the Meta pixel no separate queue is needed.
// SPA route-change page views are reported by GA4 Enhanced Measurement
// (history tracking) — never send page_view manually or they double-count.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-N5CHBCPQPF'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type GaEventName = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'generate_lead'

// item_category carries the storefront channel — same values as the Meta
// events' content_category, so both platforms segment club vs retail alike.
export interface GaItem {
  item_id: string
  item_name?: string
  item_category?: 'retail' | 'club-shop'
  price?: number
  quantity?: number
}

export interface GaEventParams {
  value?: number
  currency?: string
  transaction_id?: string
  items?: GaItem[]
}

let initialised = false

export function initGa(): void {
  if (initialised || !GA_MEASUREMENT_ID || typeof window === 'undefined') return
  initialised = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag.js requires the real Arguments object on the dataLayer — pushing a
    // spread array silently breaks command parsing.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

export function trackGaEvent(event: GaEventName, params: GaEventParams): void {
  if (typeof window === 'undefined') return
  initGa()
  window.gtag?.('event', event, params)
}
