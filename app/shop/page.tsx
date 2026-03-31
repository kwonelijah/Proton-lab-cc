import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import ShopGrid from './ShopGrid'
import ShopVideoHeader from './ShopVideoHeader'
import { getProducts } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Shop',
}

export default async function ShopPage() {
  // Stock temporarily cleared — repopulate data/products.ts and remove this override
  const inStock: Awaited<ReturnType<typeof getProducts>> = []

  return (
    <PageWrapper noPadding>
      <ShopVideoHeader />

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <ShopGrid products={inStock} />
      </div>
    </PageWrapper>
  )
}
