// Newsletter signup client — shared by the popup and the footer form.
// POSTs to the backend, which issues the welcome code and emails it.

import { BACKEND_URL } from '@/lib/checkout'
import { trackMetaEvent } from '@/lib/meta'
import { trackGaEvent } from '@/lib/ga'

export type SubscribeResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string }

export type RidingType = 'road' | 'gravel' | 'triathlon' | 'other'

export async function subscribeToNewsletter(
  email: string,
  source: 'popup' | 'footer' | 'notify',
  honeypot = '',
  riding?: RidingType
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, website: honeypot, riding }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data.error || 'Something went wrong — please try again.' }
    }
    if (!data.already) {
      trackMetaEvent('Lead', {})
      trackGaEvent('generate_lead', {})
    }
    return { ok: true, already: Boolean(data.already) }
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' }
  }
}

// Back-in-stock request from a sold-out product page. Recorded backend-side
// as an internal email (the waitlist itself); joining the mailing list is a
// separate opt-in handled by subscribeToNewsletter.
export async function notifyWhenBackInStock(
  email: string,
  handle: string,
  size: string,
  honeypot = ''
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/notify-me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, handle, size, website: honeypot }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data.error || 'Something went wrong — please try again.' }
    }
    return { ok: true, already: false }
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' }
  }
}
