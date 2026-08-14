'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ReviewCardProps {
  o: string
  e: string
  t: string
  initialRating: number | null
  initialComment: string
  initialDone: boolean
}

export default function ReviewCard({
  o,
  e,
  t,
  initialRating,
  initialComment,
  initialDone,
}: ReviewCardProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [hovered, setHovered] = useState<number | null>(null)
  const [comment, setComment] = useState(initialComment)
  const [sent, setSent] = useState(initialDone)
  const [dirty, setDirty] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!rating || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ o, e, t, r: rating, c: comment, updated: sent }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
      setDirty(false)
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setSending(false)
    }
  }

  const shown = hovered ?? rating ?? 0

  return (
    <div className="max-w-md mx-auto">
      <div
        className="flex justify-center mb-8"
        role="radiogroup"
        aria-label="Rate your kit out of five stars"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => {
              setRating(n)
              setDirty(true)
            }}
            onMouseEnter={() => setHovered(n)}
            className={cn(
              'h-11 min-w-11 px-1 text-4xl leading-none transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2',
              n <= shown ? 'text-proton-black' : 'text-proton-mid'
            )}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(ev) => {
          setComment(ev.target.value)
          setDirty(true)
        }}
        rows={4}
        maxLength={2000}
        placeholder="How's it riding? A line or two goes a long way. (optional)"
        className="w-full border border-proton-mid bg-white p-4 text-sm text-proton-black leading-relaxed placeholder:text-proton-grey outline-none focus:border-proton-black focus-visible:ring-1 focus-visible:ring-proton-black focus-visible:ring-offset-1 mb-6"
      />

      <div className="text-center">
        <Button
          type="submit"
          onClick={submit}
          disabled={!rating || sending || (sent && !dirty)}
        >
          {sending ? 'Sending…' : sent ? 'Update review' : 'Send review'}
        </Button>
        {sent && !dirty && (
          <p className="text-sm text-proton-black leading-relaxed mt-6">
            Review received — thank you.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 leading-relaxed mt-6">{error}</p>
        )}
      </div>
    </div>
  )
}
