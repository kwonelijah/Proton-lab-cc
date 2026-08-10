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

        {/* Products — grouped into Tops / Lowers / Accessories */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
          {([
            { key: 'top', label: 'Tops' },
            { key: 'lower', label: 'Lowers' },
            { key: 'accessories', label: 'Accessories' },
          ] as const).map(section => {
            const products = club.products.filter(p => p.category === section.key)
            if (products.length === 0) return null
            return (
              <section key={section.key} className="mb-16 md:mb-20 last:mb-0">
                <p className="text-[10px] uppercase tracking-widest text-proton-grey mb-8">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                  {products.map((product, i) => (
                    <Link key={product.handle} href={`/custom/club/${handle}/${product.handle}`} className="group">
                      <div className="relative aspect-[2/3] bg-proton-light overflow-hidden mb-3">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-contain transition-opacity duration-300 group-hover:opacity-90"
                          priority={section.key === 'top' && i < 4}
                        />
                      </div>
                      <h3 className="font-inter text-sm text-proton-black">{product.name}</h3>
                      <p className="text-sm text-proton-black mt-1">{product.price}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

      </main>
      <Footer />
    </>
  )
}
