'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cart'
import { COUNTRY_COOKIE, CURRENCY_SYMBOL, EUR_COUNTRIES, FREE_SHIPPING_THRESHOLD, type Currency } from '@/lib/currency'
import {
  redirectToCheckout,
  placeBankTransferOrder,
  CheckoutError,
  regionForCountry,
  countryName,
  BANK_SHIPPING_GBP,
  BANK_TRANSFER_COUNTRIES,
  type ShippingRegion,
  type DeliveryChoice,
  type BankOrderAddress,
} from '@/lib/checkout'
import { trackMetaEvent, parsePrice } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'
import { getClubByHandle } from '@/data/clubs'
import stripeProducts from '@/data/stripe-products.json'

// Cart line prices are recomputed from the price map at render time so the
// drawer always shows exactly what the selected delivery region will be
// charged. Club items are exempt — club prices are GBP agreements, and a cart
// containing one renders (and is charged) entirely in GBP, mirroring the
// backend's fallback rule.
type PriceMapEntry = { unitAmount: number; eur?: { unitAmount: number } }
const priceMap = stripeProducts as unknown as Record<string, PriceMapEntry>

function unitPrice(handle: string, fallback: string, currency: Currency): number {
  const entry = priceMap[handle]
  if (currency === 'EUR' && entry?.eur) return entry.eur.unitAmount / 100
  if (entry) return entry.unitAmount / 100
  return parsePrice(fallback)
}

function cookieCountry(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]+)`))?.[1]
}

// Geo default for the delivery selector — the region picked here decides the
// charged currency server-side (uk → GBP, ireland/europe → EUR).
function defaultRegion(): ShippingRegion {
  const country = cookieCountry()
  if (country === 'IE') return 'ireland'
  if (country && country !== 'GB' && EUR_COUNTRIES.has(country)) return 'europe'
  return 'uk'
}

// Geo default for the bank-transfer address form's country.
function defaultCountry(): string {
  const country = cookieCountry()
  return country && (BANK_TRANSFER_COUNTRIES as readonly string[]).includes(country) ? country : 'GB'
}

// Same underline inputs as ContactForm / the survey.
const inputClasses =
  'w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-2.5 outline-none focus:border-proton-black focus-visible:ring-1 focus-visible:ring-proton-black focus-visible:ring-offset-1 transition-colors duration-200 placeholder:text-proton-grey'
const labelClasses = 'text-[10px] uppercase tracking-widest text-proton-grey block mb-1'
const buttonClasses =
  'w-full bg-proton-black text-proton-white text-xs uppercase tracking-widest py-4 font-inter transition-all duration-300 hover:bg-proton-grey disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2'

// Key under which /order-received reads the receipt the backend returned.
export const BANK_ORDER_STORAGE_KEY = 'pl-bank-order'

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, clearCart } = useCartStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState<ShippingRegion>(defaultRegion)
  const [delivery, setDelivery] = useState<DeliveryChoice>('collection')
  // Bank-transfer shops collect the member's details here instead of on
  // Stripe's hosted page.
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' })
  const [address, setAddress] = useState<BankOrderAddress>({ line1: '', line2: '', city: '', postal_code: '', country: 'GB' })
  const [website, setWebsite] = useState('') // honeypot — never shown
  useEffect(() => {
    setAddress(a => ({ ...a, country: defaultCountry() }))
  }, [])

  // Currency follows the delivery region; a club item pins the whole cart to
  // GBP (club prices are GBP agreements).
  const regionCurrency: Currency = region === 'uk' ? 'GBP' : 'EUR'
  const cartCurrency: Currency = items.some(i => i.clubHandle !== 'protonlab') ? 'GBP' : regionCurrency
  const symbol = CURRENCY_SYMBOL[cartCurrency]

  // Every line from a club whose kit goes to its own distributor (data/clubs.ts
  // `centralDelivery`): nothing to post, so no region to pick and no
  // free-delivery nudge. A mixed cart (club kit plus retail) ships as a parcel
  // and pays the normal rates — the backend applies the same rule.
  const clubDelivery = items.length > 0 && items.every(i => getClubByHandle(i.clubHandle)?.centralDelivery)
  const clubDeliveryName = clubDelivery ? Array.from(new Set(items.map(i => i.clubName))).join(', ') : ''

  // Every line from a club that offers collection (`collectionOption`): the
  // member picks free "Collection from committee" or standard posted delivery
  // here, before Stripe. Collection takes the same no-address/no-charge path as
  // club delivery; the backend only honours it for an all-one-club basket.
  const collectionOption = items.length > 0 && items.every(i => getClubByHandle(i.clubHandle)?.collectionOption)
  const collectionClubName = collectionOption ? Array.from(new Set(items.map(i => i.clubName))).join(', ') : ''
  const collection = collectionOption && delivery === 'collection'
  // Nothing is posted — no region, no address, no delivery charge.
  const noPostage = clubDelivery || collection

  // Every line from a bank-transfer shop (`bankTransfer`): no Stripe — the
  // form below takes the order and the backend emails the account details.
  // Bank-transfer kit can't share a basket with anything else (one payment,
  // one shop), so a mixed basket is told to order the kit on its own.
  const bankTransfer = items.length > 0 && items.every(i => getClubByHandle(i.clubHandle)?.bankTransfer)
  const bankMixed = !bankTransfer && items.some(i => getClubByHandle(i.clubHandle)?.bankTransfer)
  const bankClubName = Array.from(new Set(items.filter(i => getClubByHandle(i.clubHandle)?.bankTransfer).map(i => i.clubName))).join(', ')

  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Prevent body scroll when drawer is open (with scrollbar compensation)
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [isOpen])

  // Save focus position, move focus into drawer on open, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, a[href], [tabindex]:not([tabindex="-1"])'
      )
      focusable?.[0]?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Focus trap + Escape to close
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeCart(); return }
      if (e.key !== 'Tab') return
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([tabindex="-1"]), select, a[href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeCart])

  const lineAmount = (i: (typeof items)[number]) =>
    i.clubHandle !== 'protonlab' ? parsePrice(i.price) : unitPrice(i.productHandle, i.price, cartCurrency)
  const subtotal = items.reduce((sum, i) => sum + lineAmount(i) * i.quantity, 0)

  // Bank-transfer preview of the delivery charge — the backend settles the
  // real figure from config/shipping.js; these mirror it (lib/checkout.ts).
  const bankRegion: ShippingRegion = regionForCountry(address.country) ?? 'uk'
  const bankShipping = noPostage ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD.GBP ? 0 : BANK_SHIPPING_GBP[bankRegion]
  const bankTotal = subtotal + bankShipping

  const checkoutItems = () =>
    items.map(item => ({
      handle: item.productHandle,
      size: item.size,
      quantity: item.quantity,
      image: item.image,
      clubName: item.clubName,
      clubHandle: item.clubHandle,
    }))

  function trackCheckoutStart() {
    trackMetaEvent('InitiateCheckout', {
      content_ids: items.map(i => i.productHandle),
      contents: items.map(i => ({ id: i.productHandle, quantity: i.quantity })),
      content_type: 'product',
      content_category: items.some(i => i.clubHandle !== 'protonlab') ? 'club-shop' : 'retail',
      currency: cartCurrency,
      value: subtotal,
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    })
    trackGaEvent('begin_checkout', {
      currency: cartCurrency,
      value: subtotal,
      items: items.map(i => ({
        item_id: i.productHandle,
        item_name: i.productName,
        item_category: i.clubHandle !== 'protonlab' ? ('club-shop' as const) : ('retail' as const),
        price: lineAmount(i),
        quantity: i.quantity,
      })),
    })
  }

  function showError(err: unknown) {
    // A 4xx carries a message the customer can act on (e.g. too many
    // different items); a 503 says the shop isn't configured yet; anything
    // else really is a connection/server problem.
    setError(
      err instanceof CheckoutError && (err.userFacing || err.status === 503)
        ? err.message
        : 'Could not connect to payment server. Please try again.'
    )
  }

  async function handleCheckout() {
    if (items.length === 0) return
    setLoading(true)
    setError(null)
    trackCheckoutStart()
    try {
      await redirectToCheckout(checkoutItems(), noPostage ? 'uk' : region, collection ? 'collection' : 'post')
    } catch (err) {
      setLoading(false)
      showError(err)
    }
  }

  async function handleBankOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (items.length === 0 || loading) return
    setLoading(true)
    setError(null)
    trackCheckoutStart()
    try {
      const receipt = await placeBankTransferOrder(
        checkoutItems(),
        { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone.trim() },
        collection ? 'collection' : 'post',
        noPostage ? null : { ...address, line2: address.line2?.trim() || '' },
        website
      )
      // /order-received reads the receipt (and the lines, for the purchase
      // events) from sessionStorage — nothing identifying goes in the URL.
      try {
        sessionStorage.setItem(
          BANK_ORDER_STORAGE_KEY,
          JSON.stringify({
            receipt,
            items: items.map(i => ({ id: i.productHandle, name: i.productName, price: lineAmount(i), quantity: i.quantity })),
            placedAt: new Date().toISOString(),
          })
        )
      } catch {
        // Storage blocked — the page falls back to "check your email".
      }
      clearCart()
      closeCart()
      setLoading(false)
      router.push('/order-received')
    } catch (err) {
      setLoading(false)
      showError(err)
    }
  }

  if (!isOpen) return null

  const deliveryRadios = collectionOption && (
    <fieldset className="space-y-2">
      <legend className="text-[10px] uppercase tracking-widest text-proton-grey mb-2">Delivery</legend>
      {([
        ['collection', 'Collection from committee', 'Free'],
        ['post', 'Standard delivery', 'from £2.99'],
      ] as [DeliveryChoice, string, string][]).map(([value, label, cost]) => (
        <label key={value} className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="cart-delivery"
              value={value}
              checked={delivery === value}
              onChange={() => setDelivery(value)}
              className="h-3.5 w-3.5 accent-proton-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
            />
            <span className="text-sm text-proton-black">{label}</span>
          </span>
          <span className="text-sm text-proton-black">{cost}</span>
        </label>
      ))}
    </fieldset>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-proton-black/40 z-50 transition-opacity duration-300"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-proton-white z-50 flex flex-col shadow-2xl"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-proton-light">
          <p className="text-[10px] uppercase tracking-widest text-proton-black">Your Cart</p>
          <button
            onClick={closeCart}
            className="p-3 -mr-2 hover:opacity-60 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2"
            aria-label="Close cart"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-proton-grey">Your cart is empty.</p>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className={`${bankTransfer ? 'max-h-[40vh]' : 'flex-1'} overflow-y-auto px-6 py-6 space-y-5`}>
              {items.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-4 pb-5 border-b border-proton-light last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-1">{item.clubName}</p>
                    <p className="text-sm text-proton-black font-inter">{item.productName}</p>
                    <p className="text-xs text-proton-grey mt-1">
                      Size: {item.size}
                      {item.quantity > 1 && <span className="ml-2">× {item.quantity}</span>}
                    </p>
                    <p className="text-sm text-proton-black mt-1">{symbol}{lineAmount(item).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-proton-grey hover:text-proton-black transition-colors duration-200 shrink-0 pt-1"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {bankMixed ? (
              /* Bank-transfer kit can't be paid together with anything else */
              <div className="px-6 py-6 border-t border-proton-light space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-proton-grey">Total</p>
                  <p className="text-sm text-proton-black">{symbol}{subtotal.toFixed(2)}</p>
                </div>
                <p role="alert" className="text-sm text-proton-black">
                  {bankClubName} kit is paid by bank transfer, so it can&apos;t be checked out with other items —
                  please remove one or the other and order them separately.
                </p>
              </div>
            ) : bankTransfer ? (
              /* Bank-transfer order form (no Stripe) */
              <form onSubmit={handleBankOrder} className="flex-1 overflow-y-auto px-6 py-6 border-t border-proton-light space-y-4">
                {deliveryRadios}
                <div className="space-y-3">
                  <div>
                    <label htmlFor="bt-name" className={labelClasses}>Name</label>
                    <input id="bt-name" name="name" type="text" required autoComplete="name" value={customer.name}
                      onChange={e => setCustomer({ ...customer, name: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label htmlFor="bt-email" className={labelClasses}>Email</label>
                    <input id="bt-email" name="email" type="email" required autoComplete="email" value={customer.email}
                      onChange={e => setCustomer({ ...customer, email: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label htmlFor="bt-phone" className={labelClasses}>Phone</label>
                    <input id="bt-phone" name="phone" type="tel" required autoComplete="tel" value={customer.phone}
                      onChange={e => setCustomer({ ...customer, phone: e.target.value })} className={inputClasses} />
                  </div>
                </div>
                {!noPostage && (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-proton-grey pt-1">Delivery address</p>
                    <div>
                      <label htmlFor="bt-line1" className={labelClasses}>Address line 1</label>
                      <input id="bt-line1" name="line1" type="text" required autoComplete="address-line1" value={address.line1}
                        onChange={e => setAddress({ ...address, line1: e.target.value })} className={inputClasses} />
                    </div>
                    <div>
                      <label htmlFor="bt-line2" className={labelClasses}>Address line 2 (optional)</label>
                      <input id="bt-line2" name="line2" type="text" autoComplete="address-line2" value={address.line2 ?? ''}
                        onChange={e => setAddress({ ...address, line2: e.target.value })} className={inputClasses} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="bt-city" className={labelClasses}>Town / city</label>
                        <input id="bt-city" name="city" type="text" required autoComplete="address-level2" value={address.city}
                          onChange={e => setAddress({ ...address, city: e.target.value })} className={inputClasses} />
                      </div>
                      <div>
                        <label htmlFor="bt-postcode" className={labelClasses}>Postcode</label>
                        <input id="bt-postcode" name="postal_code" type="text" required autoComplete="postal-code" value={address.postal_code}
                          onChange={e => setAddress({ ...address, postal_code: e.target.value })} className={inputClasses} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="bt-country" className={labelClasses}>Country</label>
                      <select id="bt-country" name="country" value={address.country}
                        onChange={e => setAddress({ ...address, country: e.target.value })}
                        className="w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-2.5 outline-none focus:border-proton-black focus-visible:ring-1 focus-visible:ring-proton-black focus-visible:ring-offset-1">
                        {BANK_TRANSFER_COUNTRIES.map(code => (
                          <option key={code} value={code}>{countryName(code)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {/* Honeypot — bots fill this, humans never see it */}
                <input type="text" value={website} onChange={e => setWebsite(e.target.value)} name="website"
                  tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <div className="space-y-1 pt-2 border-t border-proton-light">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-proton-grey">Subtotal</p>
                    <p className="text-sm text-proton-black">£{subtotal.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-proton-grey">Delivery</p>
                    <p className="text-sm text-proton-black">{bankShipping > 0 ? `£${bankShipping.toFixed(2)}` : 'Free'}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-proton-black">Total to pay</p>
                    <p className="text-sm text-proton-black font-semibold">£{bankTotal.toFixed(2)}</p>
                  </div>
                </div>
                {clubDelivery ? (
                  <p className="text-[10px] text-proton-grey text-center">
                    Delivered to {clubDeliveryName} for collection — no delivery charge
                  </p>
                ) : collection ? (
                  <p className="text-[10px] text-proton-grey text-center">
                    Collect your kit from the {collectionClubName} committee — no delivery charge, no address needed
                  </p>
                ) : bankRegion === 'europe' ? (
                  <p className="text-[10px] text-proton-grey text-center">
                    Customs charges &amp; import duties are covered — nothing extra to pay on arrival
                  </p>
                ) : null}
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className={buttonClasses}>
                  {loading ? 'Placing order…' : 'Place order'}
                </button>
                <p className="text-[10px] text-proton-grey text-center">
                  Pay by bank transfer — we&apos;ll email our account details and your payment reference as
                  soon as you place the order. Payment is due within 7 days.
                </p>
              </form>
            ) : (
              /* Checkout footer (Stripe) */
              (() => {
                const remaining = FREE_SHIPPING_THRESHOLD[cartCurrency] - subtotal
                return (
                  <div className="px-6 py-6 border-t border-proton-light space-y-4">
                    {deliveryRadios}
                    {!noPostage && (
                      <div className="flex items-center justify-between">
                        <label htmlFor="cart-region" className="text-[10px] uppercase tracking-widest text-proton-grey">
                          Deliver to
                        </label>
                        <select
                          id="cart-region"
                          value={region}
                          onChange={e => setRegion(e.target.value as ShippingRegion)}
                          className="text-sm text-proton-black bg-transparent text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black"
                        >
                          <option value="uk">United Kingdom</option>
                          <option value="ireland">Ireland</option>
                          <option value="europe">Europe</option>
                        </select>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-widest text-proton-grey">Total</p>
                      <p className="text-sm text-proton-black">{symbol}{subtotal.toFixed(2)}</p>
                    </div>
                    {clubDelivery ? (
                      <p className="text-[10px] text-proton-grey text-center">
                        Delivered to {clubDeliveryName} for collection — no delivery charge
                      </p>
                    ) : collection ? (
                      <p className="text-[10px] text-proton-grey text-center">
                        Collect your kit from the {collectionClubName} committee — no delivery charge, no address needed
                      </p>
                    ) : (
                      <>
                        <p className="text-[10px] text-proton-grey text-center">
                          {remaining > 0
                            ? `Add ${symbol}${remaining.toFixed(2)} more for free standard delivery`
                            : 'Free standard delivery unlocked'}
                        </p>
                        <p className="text-[10px] text-proton-grey text-center">
                          We currently ship to the UK, Ireland &amp; Europe only
                        </p>
                      </>
                    )}
                    {!noPostage && region === 'europe' && (
                      <p className="text-[10px] text-proton-grey text-center">
                        Customs charges &amp; import duties are covered — nothing extra to pay on arrival
                      </p>
                    )}
                    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                    <button onClick={handleCheckout} disabled={loading} className={buttonClasses}>
                      {loading ? 'Redirecting…' : 'Checkout'}
                    </button>
                    <p className="text-[10px] text-proton-grey text-center">
                      Secure checkout via Stripe · Discount codes applied at checkout
                    </p>
                  </div>
                )
              })()
            )}
          </>
        )}
      </div>
    </>
  )
}
