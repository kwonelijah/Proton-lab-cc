import { getFbCookies } from '@/lib/meta'
import { getGaCookies } from '@/lib/ga'
import { getAttribution } from '@/lib/attribution'

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

// How the kit reaches the customer. 'collection' is only offered for carts
// made up entirely of a club with `collectionOption` (data/clubs.ts) and is
// verified server-side against the backend's COLLECTION_OPTION_CLUBS; the
// session then collects no address and charges no delivery.
export type DeliveryChoice = 'post' | 'collection'

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

// Meta attribution cookies ride along so the backend can stamp them onto the
// order and send a fully-attributed Conversions API Purchase event. GA
// cookies do the same for the server-side GA4 Measurement Protocol purchase —
// same client_id as this browser, so GA4 dedups the pair. Marketing
// attribution (utm_* / referrer, lib/attribution.ts) feeds the order
// dashboard's Analytics tab. Shared by both order paths below.
function attributionPayload() {
  const { fbp, fbc } = getFbCookies()
  const { gaClientId, gaSessionId } = getGaCookies()
  const attribution = getAttribution()
  return { fbp, fbc, gaClientId, gaSessionId, attribution }
}

export async function redirectToCheckout(
  items: CheckoutItem[],
  shippingRegion: ShippingRegion = 'uk',
  delivery: DeliveryChoice = 'post'
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, shippingRegion, delivery, ...attributionPayload() }),
  })

  const data = await res.json().catch(() => ({}))
  if (data.error) throw new CheckoutError(data.error, res.status)
  if (!data.url) throw new CheckoutError('No checkout URL returned', res.status)

  window.location.href = data.url
}

// ─── Bank-transfer club shops ────────────────────────────────────────────────
// Shops flagged `bankTransfer` in data/clubs.ts take no card payment: the cart
// collects the member's details here and the backend
// (protonlab-backend/api/bank-transfer-order.js) records the order and emails
// Proton Lab's account details with a unique payment reference. Prices and
// delivery are settled server-side exactly as for Stripe; the numbers below
// only drive the cart's preview and mirror protonlab-backend/config/shipping.js
// — update together.

export interface BankOrderCustomer {
  name: string
  email: string
  phone: string
}

export interface BankOrderAddress {
  line1: string
  line2?: string
  city: string
  state?: string
  postal_code: string
  country: string // 2-letter code from BANK_TRANSFER_COUNTRIES
}

export interface BankDetails {
  accountName: string
  sortCode: string
  accountNumber: string
  iban?: string
  bic?: string
}

export interface BankOrderReceipt {
  id: string // bt_NNNNN
  ref: string // "<Club> #NNNNN"
  payRef: string // PL-NNNNN — the reference to put on the transfer
  club: string
  clubHandle: string
  amount: string // "123.00" (GBP, incl. delivery)
  subtotal: string
  shippingAmount: string
  delivery: 'post' | 'collection' | 'club'
  payBy: string // ISO
  bank: BankDetails
  email: string
  emailed: boolean
}

// Standard-rate delivery in GBP per zone (free at/over FREE_SHIPPING_THRESHOLD.GBP).
export const BANK_SHIPPING_GBP: Record<ShippingRegion, number> = { uk: 2.99, ireland: 2.99, europe: 5.99 }

// GB, IE and the backend's EUROPE_COUNTRIES — the only destinations accepted.
export const BANK_TRANSFER_COUNTRIES = [
  'GB', 'IE',
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const

export function regionForCountry(country: string): ShippingRegion | null {
  if (country === 'GB') return 'uk'
  if (country === 'IE') return 'ireland'
  return (BANK_TRANSFER_COUNTRIES as readonly string[]).includes(country) ? 'europe' : null
}

const FALLBACK_COUNTRY_NAMES: Record<string, string> = { GB: 'United Kingdom', IE: 'Ireland' }
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) ?? code
  } catch {
    return FALLBACK_COUNTRY_NAMES[code] ?? code
  }
}

export async function placeBankTransferOrder(
  items: CheckoutItem[],
  customer: BankOrderCustomer,
  delivery: DeliveryChoice,
  address: BankOrderAddress | null,
  website = '' // honeypot — humans never see the field, so it is always ''
): Promise<BankOrderReceipt> {
  const res = await fetch(`${BACKEND_URL}/api/bank-transfer-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, customer, delivery, address, website, ...attributionPayload() }),
  })

  const data = await res.json().catch(() => ({}))
  if (data.error) throw new CheckoutError(data.error, res.status)
  if (!data.ok || !data.id) throw new CheckoutError('No order confirmation returned', res.status)
  return data as BankOrderReceipt
}
