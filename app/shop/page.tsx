import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import ShopGrid from './ShopGrid'
import { getProducts } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Shop',
}

export default async function ShopPage() {
  const products = await getProducts()
  const inStock = products.filter(p => p.availableForSale)

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 md:py-8">
        <h1 className="font-playfair text-4xl md:text-6xl text-proton-black leading-none mb-6 md:mb-8">
          Shop
        </h1>
        <ShopGrid products={inStock} />
      </div>
    </PageWrapper>
  )
}
