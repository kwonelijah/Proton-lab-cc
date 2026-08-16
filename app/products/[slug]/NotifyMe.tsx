'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { notifyWhenBackInStock, subscribeToNewsletter } from '@/lib/newsletter'

// Back-in-stock capture, rendered by VariantSelector when every size of a
// product is sold out. The request itself only asks for a restock notice —
// joining the mailing list is a separate unticked opt-in, because wanting one
// email about one jersey is not marketing consent.

interface NotifyMeProps {
  productHandle: string
  sizes: string[]
}

export default function NotifyMe({ productHandle, sizes }: NotifyMeProps) {
  const [email, setEmail] = useState('')
  const [size, setSize] = useState('')
  const [alsoSubscribe, setAlsoSubscribe] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setError(null)
    setStatus('sending')
    const result = await notifyWhenBackInStock(email, productHandle, size, honeypot)
    if (!result.ok) {
      setStatus('idle')
      setError(result.error)
      return
    }
    // Mailing-list opt-in rides the normal subscribe path (dedupe, 10% code,
    // welcome email). Best-effort: the restock request is already recorded.
    if (alsoSubscribe) {
      subscribeToNewsletter(email, 'notify', honeypot).catch(() => {})
    }
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <div className="pt-2">
        <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-2">Sold out</p>
        <p className="text-sm text-proton-black">
          We&apos;ll email you when it&apos;s back.
        </p>
      </div>
    )
  }

  return (
    <div className="pt-2 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-2">Sold out</p>
        <p className="text-sm text-proton-grey leading-relaxed">
          Leave your email and we&apos;ll let you know the moment it&apos;s back.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Honeypot — humans never see this */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <div className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            className="flex-1 min-w-0 border border-proton-mid bg-transparent px-4 py-3 text-sm text-proton-black placeholder:text-proton-grey focus:outline-none focus:border-proton-black transition-colors duration-200"
          />
          <select
            value={size}
            onChange={e => setSize(e.target.value)}
            aria-label="Size"
            className="shrink-0 border border-proton-mid bg-transparent px-3 py-3 text-xs uppercase tracking-widest text-proton-black focus:outline-none focus:border-proton-black transition-colors duration-200 cursor-pointer"
          >
            <option value="">Any size</option>
            {sizes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoSubscribe}
            onChange={e => setAlsoSubscribe(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-black"
          />
          <span className="text-xs text-proton-grey leading-relaxed">
            Also join the mailing list — 10% off your first order. Unsubscribe
            anytime.
          </span>
        </label>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === 'sending'}
          className="w-full justify-center"
        >
          {status === 'sending' ? 'Sending…' : 'Notify Me'}
        </Button>
        {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
      </form>
    </div>
  )
}
