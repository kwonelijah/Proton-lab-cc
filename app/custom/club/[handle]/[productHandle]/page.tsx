'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getClubByHandle, type Club, type ClubProduct } from '@/data/clubs'
import { getClubProductByHandle } from '@/lib/api'
import type { Product, ProductImage } from '@/types/product'
import ProductGallery from '@/app/products/[slug]/ProductGallery'
import ClubVariantSelector from './ClubVariantSelector'
import Accordion from '@/components/ui/Accordion'
import DeliveryNote from '@/components/ui/DeliveryNote'
import { CARD_LABEL } from '@/components/ui/ProductCard'

export default function ClubProductPage() {
  const { handle, productHandle } = useParams<{ handle: string; productHandle: string }>()
  const router = useRouter()

  const [club, setClub] = useState<Club | null>(null)
  const [clubProduct, setClubProduct] = useState<ClubProduct | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const found = getClubByHandle(handle)
    if (!found) { router.push('/custom/club'); return }

    const ok = sessionStorage.getItem(`club-auth-${handle}`) === 'true'
    if (!ok) { router.push('/custom/club'); return }

    const cp = found.products.find(p => p.handle === productHandle)
    if (!cp) { router.push(`/custom/club/${handle}`); return }

    setClub(found)
    setClubProduct(cp)
    setAuthed(true)

    getClubProductByHandle(cp.catalogHandle ?? productHandle).then(p => {
      if (p) setProduct(p)
    })
  }, [handle, productHandle, router])

  if (!authed || !club || !clubProduct) return null

  // Featured design image first, then any additional custom images, then general product images
  const featuredImage: ProductImage = {
    id: 'club-featured',
    url: clubProduct.image,
    altText: `${clubProduct.name} — club design`,
    width: 1200,
    height: 1800,
  }
  const customImages: ProductImage[] = (clubProduct.customImages ?? [])
    .filter(url => url !== clubProduct.image)
    .map((url, i) => ({
      id: `club-img-${i}`,
      url,
      altText: `${clubProduct.name} — custom design`,
      width: 1200,
      height: 1800,
    }))
  const generalImages: ProductImage[] = (clubProduct.hideCatalogImages ? [] : product?.images.nodes ?? [])
    .filter(img => img.url !== clubProduct.image && !img.url.includes('blank.png'))
  const allImages = [featuredImage, ...customImages, ...generalImages]

  // All sizes orderable for club kit
  const variants = (product?.variants.nodes ?? []).map(v => ({
    ...v,
    availableForSale: true,
  }))

  // Details panel — the top-right cell of the full-bleed mosaic, matching the
  // retail product page and the club landing grid.
  const info = (
            <div className="space-y-8">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className={`flex items-center gap-2 ${CARD_LABEL} text-proton-grey`}>
                <Link href={`/custom/club/${handle}`} className="hover:text-proton-black transition-colors duration-200">
                  {club.name}
                </Link>
                <span>/</span>
                <span className="text-proton-black">{clubProduct.name}</span>
              </nav>

              {/* Title + price */}
              <div className="flex items-start justify-between gap-x-4">
                <h1 className={`${CARD_LABEL} min-w-0 flex-1 text-proton-black`}>
                  {clubProduct.name}
                </h1>
                <p className={`${CARD_LABEL} shrink-0 text-right text-proton-grey md:font-bold md:text-sm md:text-proton-black`}>{clubProduct.price}</p>
              </div>

              <ClubVariantSelector
                variants={variants}
                productHandle={clubProduct.catalogHandle ?? productHandle}
                productName={clubProduct.name}
                clubHandle={handle}
                clubName={club.name}
                price={clubProduct.price}
                variant={clubProduct.variant}
                showFit={clubProduct.category !== 'accessories'}
              />

              <DeliveryNote
                collectionVia={club.centralDelivery ? club.name : undefined}
                collectionChoice={club.collectionOption ? club.name : undefined}
                bankTransfer={club.bankTransfer}
              />

              {product?.description && (
                <div className="pt-4 border-t border-proton-light">
                  <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">Description</p>
                  <p className="text-sm text-proton-black leading-relaxed">{product.description}</p>
                </div>
              )}

              {product?.bullets && product.bullets.length > 0 && (
                <div className="pt-4 border-t border-proton-light">
                  <ul className="space-y-2">
                    {product.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-proton-black">
                        <span className="mt-2 w-1 h-1 rounded-full bg-proton-black shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Accordion title="Size Guide">
                <p className="text-xs text-proton-grey leading-relaxed mb-5">
                  All measurements are in centimetres. Measure yourself and compare with the chart below. If you&apos;re between sizes, we recommend sizing up for a more relaxed fit.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-proton-light">
                        {['Size', 'Chest', 'Waist', 'Hip'].map(h => (
                          <th key={h} className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-proton-grey font-inter font-normal">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        // 2XS / 2XL extrapolated from the XS–XL steps (+4 chest,
                        // +6 waist, +6 hip per size) — confirm against the factory chart.
                        ['2XS', '80', '66', '81'],
                        ['XS', '84', '72', '87'],
                        ['S',  '88', '78', '93'],
                        ['M',  '92', '84', '99'],
                        ['L',  '96', '90', '105'],
                        ['XL', '100', '96', '111'],
                        ['2XL', '104', '102', '117'],
                      ].map(([size, chest, waist, hip], i) => (
                        <tr key={size} className={`border-b border-proton-light/60 ${i % 2 === 1 ? 'bg-proton-light/30' : ''}`}>
                          <td className="py-2.5 pr-6 text-sm text-proton-black font-inter">{size}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{chest}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{waist}</td>
                          <td className="py-2.5 pr-6 text-sm text-proton-grey font-inter">{hip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Accordion>

              <Accordion title="Care & Washing">
                <ul className="space-y-2.5">
                  {[
                    'Machine wash at 30°C in garment bag or handwash',
                    'Delicate cycle / Quick wash',
                    'Wash dark and bright colors separately',
                    'No synthetics wash / Do not bleach',
                    'Do not dry clean / Do not tumble dry / Do not iron',
                  ].map((line, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-proton-grey">
                      <span className="mt-2 w-1 h-1 rounded-full bg-proton-grey shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Accordion>
            </div>
  )

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-proton-white pt-20">
        <ProductGallery images={allImages} productTitle={clubProduct.name} info={info} />
      </main>
      <Footer />
    </>
  )
}
