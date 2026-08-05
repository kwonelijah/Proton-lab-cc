import { cookies, headers } from 'next/headers'
import { CURRENCY_COOKIE, currencyForCountry, isCurrency, type Currency } from '@/lib/currency'

// Display currency for the current request. The cookie (set by middleware on
// first visit, overwritten by the £/€ toggle) wins; on the very first request
// the cookie isn't on the request yet, so fall back to the same geo header
// middleware used. Reading these APIs opts the route into per-request
// rendering — intentional, prices differ per visitor.
export function getDisplayCurrency(): Currency {
  const fromCookie = cookies().get(CURRENCY_COOKIE)?.value
  if (isCurrency(fromCookie)) return fromCookie
  return currencyForCountry(headers().get('x-vercel-ip-country'))
}
