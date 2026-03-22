'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getClubByHandle, type Club, type ClubProduct } from '@/data/clubs'
import { getProductByHandle } from '@/lib/api'
import type { Product, ProductImage } from '@/types/product'
import ProductGallery from '@/app/products/[slug]/ProductGallery'
import ClubVariantSelector from './ClubVariantSelector'

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

    getProductByHandle(productHandle).then(p => {
      if (p) setProduct(p)
    })
  }, [handle, productHandle, router])

  if (!authed || !club || !clubProduct) return null

  // Custom club images first, then general product images
  const customImages: ProductImage[] = (clubProduct.customImages ?? []).map((url, i) => ({
    id: `club-img-${i}`,
    url,
    altText: `${clubProduct.name} — custom design`,
    width: 800,
    height: 1000,
  }))
  const generalImages: ProductImage[] = product?.images.nodes ?? []
  const allImages = [...customImages, ...generalImages]

  // All sizes orderable for club kit
  const variants = (product?.variants.nodes ?? []).map(v => ({
    ...v,
    availableForSale: true,
  }))

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-proton-white pt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-proton-grey mb-8">
            <Link href={`/custom/club/${handle}`} className="hover:text-proton-black transition-colors duration-200">
              {club.name}
            </Link>
            <span>/</span>
            <span className="text-proton-black">{clubProduct.name}</span>
          </nav>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20">
            {/* Gallery */}
            {allImages.length > 0 ? (
              <ProductGallery images={allImages} productTitle={clubProduct.name} />
            ) : (
              <div className="aspect-[4/5] bg-proton-light" />
            )}

            {/* Details */}
            <div className="md:sticky md:top-24 md:self-start space-y-8">
              <div>
                <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-2">
                  {club.name}
                </p>
                <h1 className="font-playfair text-3xl md:text-4xl leading-tight mb-4">
                  {clubProduct.name}
                </h1>
                <p className="text-xl text-proton-black">{clubProduct.price}</p>
              </div>

              <ClubVariantSelector
                variants={variants}
                productHandle={productHandle}
                productName={clubProduct.name}
                clubHandle={handle}
                clubName={club.name}
                price={clubProduct.price}
              />

              {product?.description && (
                <div className="pt-4 border-t border-proton-light">
                  <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">Description</p>
                  <p className="text-sm text-proton-black leading-relaxed">{product.description}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  )
}
