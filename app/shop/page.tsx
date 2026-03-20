import type { Metadata } from 'next'
import Image from 'next/image'
import PageWrapper from '@/components/layout/PageWrapper'
import ShopGrid from './ShopGrid'
import { getProducts } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Shop Collection',
}

export default async function ShopPage() {
  const products = await getProducts()
  const inStock = products.filter(p => p.availableForSale)

  return (
    <PageWrapper noPadding>
      {/* Header image */}
      <div className="relative w-full aspect-[21/9] bg-proton-light overflow-hidden">
        <Image
          src="/images/collections/collection2.JPG"
          alt="Shop Collection"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-proton-black/30" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl w-full mx-auto px-6 md:px-12 pb-10 md:pb-14">
            <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">In Stock</p>
            <h1 className="font-playfair text-5xl md:text-7xl text-proton-white leading-none">
              Shop Collection
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <ShopGrid products={inStock} />
      </div>
    </PageWrapper>
  )
}
