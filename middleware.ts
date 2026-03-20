import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ─── TEAM STORE AUTHENTICATION STUB ─────────────────────────────────────────
  // When auth is implemented, uncomment and configure:
  //
  // const token = request.cookies.get('proton-team-token')
  // if (!token) {
  //   return NextResponse.redirect(new URL('/team-store/login', request.url))
  // }
  //
  // For per-team access control:
  // const team = request.nextUrl.pathname.split('/')[2]
  // const allowedTeam = token.value // decode JWT to get allowed team
  // if (team !== allowedTeam) {
  //   return NextResponse.redirect(new URL('/team-store/unauthorised', request.url))
  // }

  return NextResponse.next()
}

export const config = {
  matcher: ['/team-store/:path*'],
}
