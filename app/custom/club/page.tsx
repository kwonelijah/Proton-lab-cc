'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getClubByPassword } from '@/data/clubs'

export default function ClubGatePage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const club = getClubByPassword(password.trim())
    if (club) {
      sessionStorage.setItem(`club-auth-${club.handle}`, 'true')
      router.push(`/custom/club/${club.handle}`)
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center bg-proton-white pt-20">
        <div className="w-full max-w-sm mx-auto px-6 text-center">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">Club Access</p>
          <h1 className="font-playfair text-4xl text-proton-black mb-2">Club Store</h1>
          <p className="text-sm text-proton-grey mb-10 leading-relaxed">
            Enter your club password to access your kit store.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="Enter password"
              autoComplete="off"
              className={`w-full border px-4 py-3 text-sm font-inter bg-transparent text-proton-black placeholder:text-proton-grey/50 focus:outline-none transition-colors duration-200 ${
                error ? 'border-red-400' : 'border-proton-light focus:border-proton-black'
              }`}
            />
            {error && (
              <p className="text-xs text-red-500 -mt-2">Incorrect password.</p>
            )}
            <button
              type="submit"
              className="w-full border border-proton-black px-6 py-3 text-xs uppercase tracking-widest font-inter text-proton-black hover:bg-proton-black hover:text-proton-white transition-all duration-300"
            >
              Enter
            </button>
          </form>

          <p className="text-xs text-proton-grey mt-8">
            Don&apos;t have a password?{' '}
            <a href="/contact" className="underline hover:text-proton-black transition-colors duration-200">
              Contact us
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
