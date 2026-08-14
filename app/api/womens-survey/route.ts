import { NextResponse } from 'next/server'
import { BACKEND_URL } from '@/lib/checkout'

// Server-side proxy to the backend survey intake (protonlab-backend
// /api/womens-survey), which owns the sheet append, the 20% code, the
// Resend audience add and the info@ notification. Proxying server-side
// avoids CORS entirely, so the form works identically on localhost and
// in production.
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/womens-survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — please try again.' },
      { status: 502 }
    )
  }
}
