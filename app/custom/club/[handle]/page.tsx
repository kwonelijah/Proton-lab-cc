'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getClubByHandle, type Club } from '@/data/clubs'

export default function ClubShopPage() {
  const { handle } = useParams<{ handle: string }>()
  const router = useRouter()
  const [club, setClub] = useState<Club | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const found = getClubByHandle(handle)
    if (!found) { router.push('/custom/club'); return }

    const ok = sessionStorage.getItem(`club-auth-${handle}`) === 'true'
    if (!ok) { router.push('/custom/club'); return }

    setClub(found)
    setAuthed(true)
  }, [handle, router])

  if (!authed || !club) return null

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-proton-white pt-20">

        {/* Header */}
        <div className="border-b border-proton-light">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
            <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">Club Store</p>
            <h1 className="font-playfair text-5xl md:text-6xl text-proton-black leading-none mb-4">
              {club.name}
            </h1>
            <p className="text-sm text-proton-grey">{club.tagline}</p>
          </div>
        </div>

        {/* Products */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {club.products.map((product, i) => (
              <div key={product.handle} className="group">
                <div className="relative aspect-[4/5] bg-proton-light overflow-hidden mb-3">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={i < 4}
                  />
                </div>
                <h3 className="font-inter text-sm text-proton-black">{product.name}</h3>
                <p className="text-sm text-proton-grey mt-1">{product.price}</p>
                <button className="mt-3 w-full border border-proton-black px-4 py-2 text-[10px] uppercase tracking-widest font-inter text-proton-black hover:bg-proton-black hover:text-proton-white transition-all duration-300">
                  Request Order
                </button>
              </div>
            ))}
          </div>

          {/* Order note */}
          <div className="mt-20 border-t border-proton-light pt-10 max-w-lg">
            <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-3">How to Order</p>
            <p className="text-sm text-proton-grey leading-relaxed">
              Select the items you need and contact us with your sizes and quantities. We&apos;ll confirm your order and arrange delivery directly with your club.
            </p>
            <a
              href="/contact"
              className="inline-block mt-6 border border-proton-black px-6 py-3 text-xs uppercase tracking-widest font-inter text-proton-black hover:bg-proton-black hover:text-proton-white transition-all duration-300"
            >
              Place Order
            </a>
          </div>
        </div>

      </main>
      <Footer />
    </>
  )
}
