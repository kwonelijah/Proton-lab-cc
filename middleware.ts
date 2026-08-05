import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CURRENCY_COOKIE, COUNTRY_COOKIE, currencyForCountry } from '@/lib/currency'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Stamp display-currency + country cookies on first visit so both server
  // components and client stores agree from the first paint. The £/€ toggle
  // overwrites pl-currency; pl-country only informs the cart's default
  // delivery zone (Ireland pays EUR but ships under UK & Ireland).
  const country = request.headers.get('x-vercel-ip-country') || 'GB'
  if (!request.cookies.get(CURRENCY_COOKIE)) {
    response.cookies.set(CURRENCY_COOKIE, currencyForCountry(country), {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    })
  }
  if (!request.cookies.get(COUNTRY_COOKIE)) {
    response.cookies.set(COUNTRY_COOKIE, country, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  // Pages only — skip Next internals, API routes and public/ assets (anything
  // with a file extension). Widened from the dormant /team-store auth stub.
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
}
