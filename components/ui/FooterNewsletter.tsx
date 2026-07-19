'use client'

import { useState } from 'react'
import { subscribeToNewsletter } from '@/lib/newsletter'

// Footer newsletter field — the persistent signup entry point for visitors
// who dismissed the popup. Sits on the black footer band, so inverted styling.

export default function FooterNewsletter() {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    setError(null)
    setStatus('sending')
    const result = await subscribeToNewsletter(email, 'footer', honeypot)
    if (!result.ok) {
      setStatus('idle')
      setError(result.error)
      return
    }
    localStorage.setItem('pl_newsletter', 'subscribed')
    setStatus(result.already ? 'already' : 'done')
  }

  if (status === 'done' || status === 'already') {
    return (
      <p className="text-xs text-proton-white/80 tracking-wide">
        {status === 'already'
          ? 'You’re already on the list.'
          : 'Check your inbox — your 10% code is on its way.'}
      </p>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <p className="text-[10px] uppercase tracking-widest text-proton-white/60 mb-3">
        Get 10% off your first order
      </p>
      <form onSubmit={handleSubmit} className="flex">
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
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          aria-label="Email address"
          className="flex-1 min-w-0 border border-proton-white/30 bg-transparent px-4 py-3 text-sm text-proton-white placeholder:text-proton-white/40 focus:outline-none focus:border-proton-white transition-colors duration-200"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="shrink-0 bg-proton-white text-proton-black text-xs uppercase tracking-widest px-5 font-inter transition-opacity duration-300 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-white"
        >
          {status === 'sending' ? '…' : 'Join'}
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-red-400 mt-2">{error}</p>}
      <p className="text-[10px] text-proton-white/40 leading-relaxed mt-3">
        Marketing emails from Proton Lab — unsubscribe anytime.
      </p>
    </div>
  )
}
