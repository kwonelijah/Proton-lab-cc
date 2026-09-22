'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'

import Footer from '@/components/layout/Footer'
import { getClubByHandle, type Club } from '@/data/clubs'
import { getClubProductByHandle } from '@/lib/api'
import type { ProductImage } from '@/types/product'

const CATEGORIES = [
  { key: 'top', label: 'Tops' },
  { key: 'lower', label: 'Lowers' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'running', label: 'Running' },
] as const

export default function ClubShopPage() {
  const { handle } = useParams<{ handle: string }>()
  const router = useRouter()
  const [club, setClub] = useState<Club | null>(null)
  const [authed, setAuthed] = useState(false)
  // First catalogue photo per club product (the plain garment, not the club
  // design), faded in on hover. Products flagged hideCatalogImages get none.
  const [hoverImages, setHoverImages] = useState<Record<string, ProductImage>>({})
  const [filter, setFilter] = useState<'all' | (typeof CATEGORIES)[number]['key']>('all')

  useEffect(() => {
    const found = getClubByHandle(handle)
    if (!found) { router.push('/custom/club'); return }

    const ok = sessionStorage.getItem(`club-auth-${handle}`) === 'true'
    if (!ok) { router.push('/custom/club'); return }

    setClub(found)
    setAuthed(true)

    let cancelled = false
    Promise.all(found.products.map(async cp => {
      if (cp.hideCatalogImages) return null
      const product = await getClubProductByHandle(cp.catalogHandle ?? cp.handle)
      const img = product?.images.nodes.find(i => i.url !== cp.image && !i.url.includes('blank.png'))
      return img ? ([cp.handle, img] as const) : null
    })).then(entries => {
      if (cancelled) return
      const next: Record<string, ProductImage> = {}
      for (const e of entries) if (e) next[e[0]] = e[1]
      setHoverImages(next)
    })
    return () => { cancelled = true }
  }, [handle, router])

  if (!authed || !club) return null

  // One group per category that this club actually stocks, in display order.
  const groups = CATEGORIES
    .map(c => ({ ...c, products: club.products.filter(p => p.category === c.key) }))
    .filter(c => c.products.length > 0)
  const visible = filter === 'all' ? groups.flatMap(g => g.products) : club.products.filter(p => p.category === filter)

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-proton-white pt-20">

        {/* Header */}
        <div className="border-b border-proton-light">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
            <h1 className="font-playfair text-5xl md:text-6xl text-proton-black leading-none mb-4">
              {club.name}
            </h1>
            {club.tagline.includes('\n') ? <ul className="list-disc pl-4 space-y-1.5 text-sm text-proton-grey marker:text-proton-grey">{club.tagline.split('\n').map((line, li) => (<li key={li}>{line.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-proton-black">{part}</strong> : part)}</li>))}</ul> : <p className="text-sm text-proton-grey">{club.tagline.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-proton-black">{part}</strong> : part)}</p>}
          </div>
        </div>

        {/* Products — one grid, filtered by category chips */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-8 md:pt-10 pb-16 md:pb-24">
          <div className="flex flex-wrap gap-2 pb-6 md:pb-8 mb-10 md:mb-12 border-b border-proton-light" role="group" aria-label="Filter by category">
            {[{ key: 'all', label: 'All' } as const, ...groups].map(chip => {
              const isActive = filter === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter(chip.key)}
                  className={`h-11 px-5 border text-xs uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proton-black focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-proton-black text-proton-white border-proton-black'
                      : 'bg-transparent text-proton-black border-proton-mid hover:border-proton-black'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {visible.map((product, i) => (
              <Link key={product.handle} href={`/custom/club/${handle}/${product.handle}`} className="group">
                <div className="relative aspect-[2/3] bg-proton-light overflow-hidden mb-3">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className={`object-contain transition-opacity duration-300 ${hoverImages[product.handle] ? 'group-hover:opacity-0 group-focus-visible:opacity-0' : 'group-hover:opacity-90'}`}
                    priority={i < 4}
                  />
                  {hoverImages[product.handle] && (
                    <Image
                      src={hoverImages[product.handle].url}
                      alt={`${product.name} — catalogue photo`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className={`${hoverImages[product.handle].width > hoverImages[product.handle].height ? 'object-contain' : 'object-cover'} opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100`}
                    />
                  )}
                </div>
                <h3 className="font-inter text-sm text-proton-black">{product.name}</h3>
                <p className="text-sm text-proton-black mt-1">{product.price}</p>
              </Link>
            ))}
          </div>
        </div>

      </main>
      <Footer />
    </>
  )
}
