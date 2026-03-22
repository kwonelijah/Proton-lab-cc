'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

const inputClasses =
  'w-full bg-transparent border-b border-proton-mid text-proton-black text-sm py-3 outline-none focus:border-proton-black transition-colors duration-200 placeholder:text-proton-grey'

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      subject: (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    setLoading(false)

    if (res.ok) {
      setSubmitted(true)
    } else {
      setError('Something went wrong. Please try again or email us directly.')
    }
  }

  if (submitted) {
    return (
      <div className="py-12">
        <p className="font-playfair text-2xl text-proton-black mb-3">Thank you.</p>
        <p className="text-sm text-proton-grey">
          We&apos;ll be in touch shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label htmlFor="name" className="text-[10px] uppercase tracking-widest text-proton-grey block mb-2">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="email" className="text-[10px] uppercase tracking-widest text-proton-grey block mb-2">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="subject" className="text-[10px] uppercase tracking-widest text-proton-grey block mb-2">
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          required
          className={`${inputClasses} cursor-pointer`}
          defaultValue=""
        >
          <option value="" disabled>Select a subject</option>
          <option value="general">General Enquiry</option>
          <option value="sizing">Sizing & Fit</option>
          <option value="team-store">Team Store</option>
          <option value="press">Press & Media</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="text-[10px] uppercase tracking-widest text-proton-grey block mb-2">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Your message"
          className={`${inputClasses} resize-none`}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={loading}>
        {loading ? 'Sending…' : 'Send Message'}
      </Button>
    </form>
  )
}
