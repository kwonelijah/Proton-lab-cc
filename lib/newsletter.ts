// Newsletter signup client — shared by the popup and the footer form.
// POSTs to the backend, which issues the welcome code and emails it.

import { BACKEND_URL } from '@/lib/checkout'
import { trackMetaEvent } from '@/lib/meta'

export type SubscribeResult =
  | { ok: true; already: boolean }
  | { ok: false; error: string }

export async function subscribeToNewsletter(
  email: string,
  source: 'popup' | 'footer',
  honeypot = ''
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, website: honeypot }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data.error || 'Something went wrong — please try again.' }
    }
    if (!data.already) trackMetaEvent('Lead', {})
    return { ok: true, already: Boolean(data.already) }
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' }
  }
}
