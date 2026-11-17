'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ShopFilter from '@/app/shop/ShopFilter'
import { CARD_LABEL } from '@/components/ui/ProductCard'
import { ALL_CATEGORY, type ShopCategory } from '@/lib/shop-categories'
import { getClubByHandle, type Club } from '@/data/clubs'
import { getClubProductByHandle } from '@/lib/api'
import type { ProductImage } from '@/types/product'

// Hairline black dividers: a top border on the grid, a bottom border on every cell and
// a right border on every cell except the last column (2 columns on phones,
// 4 from md up). Cells touch, so the borders are the only separation.
const CELL =
  'border-b border-proton-black [&:not(:nth-child(2n))]:border-r md:[&:not(:nth-child(4n))]:border-r'

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
  const [filter, setFilter] = useState<string>(ALL_CATEGORY)

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
  const visible = filter === ALL_CATEGORY
    ? groups.flatMap(g => g.products)
    : club.products.filter(p => p.category === filter)
  const filterOptions: ShopCategory[] = groups.map(g => ({ key: g.key, label: g.label, tags: [] }))

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

        {/* Filter bar — the same FILTER control as /shop, right-aligned; only
            shown when the club stocks more than one category. */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-1 md:py-2">
          <div className="flex items-center justify-end min-h-[2.75rem]">
            {groups.length > 1 && (
              <ShopFilter categories={filterOptions} value={filter} onChange={setFilter} />
            )}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'product' : 'products'}
        </p>

        {/* Products — full-bleed grid like /shop: a sibling of the container,
            zero column gap, 4 columns on desktop / 2 on phones. Club renders
            are composed with wide margins, so the 4:5 crop (cover) is safe. */}
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-proton-black pb-10 md:pb-14">
          {visible.map((product, i) => {
            const hover = hoverImages[product.handle]
            return (
              <li key={product.handle} className={CELL}>
                <Link href={`/custom/club/${handle}/${product.handle}`} className="group block">
                  <div className="relative aspect-[4/5] bg-proton-light overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 767px) 50vw, 25vw"
                      className={`object-cover transition-opacity duration-300 ${hover ? 'group-hover:opacity-0 group-focus-visible:opacity-0' : ''}`}
                      priority={i < 4}
                    />
                    {hover && (
                      <Image
                        src={hover.url}
                        alt={`${product.name} — catalogue photo`}
                        fill
                        sizes="(max-width: 767px) 50vw, 25vw"
                        className={`${hover.width > hover.height ? 'object-contain' : 'object-cover'} opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100`}
                      />
                    )}
                  </div>
                  {/* Name left, price right — no sizes line: club garments are
                      made to order in every size. */}
                  <div className="px-4 pt-4 pb-2.5">
                    <div className="flex items-start justify-between gap-x-3">
                      <h3 className={`${CARD_LABEL} min-w-0 flex-1 text-proton-black group-hover:opacity-60 transition-opacity duration-200`}>
                        {product.name}
                      </h3>
                      <p className={`${CARD_LABEL} shrink-0 text-right text-proton-grey`}>{product.price}</p>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

      </main>
      <Footer />
    </>
  )
}
