import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CURRENCY_COOKIE, COUNTRY_COOKIE, currencyForCountry } from '@/lib/currency'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Display currency is a pure function of geolocation, re-asserted on every
  // request so a stale value can never persist. There is deliberately no user
  // override: the CHARGED currency is bound server-side to the delivery
  // region at checkout (create-checkout-session.js), and display follows geo.
  // pl-country informs the cart's default delivery region (GB/IE/EU split).
  const country = request.headers.get('x-vercel-ip-country') || 'GB'
  const cookieOpts = { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' as const }
  response.cookies.set(CURRENCY_COOKIE, currencyForCountry(country), cookieOpts)
  response.cookies.set(COUNTRY_COOKIE, country, cookieOpts)

  return response
}

export const config = {
  // Pages only — skip Next internals, API routes and public/ assets (anything
  // with a file extension).
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
}
