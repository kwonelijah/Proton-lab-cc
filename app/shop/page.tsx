import type { Metadata } from 'next'
import PageWrapper from '@/components/layout/PageWrapper'
import ShopCollection from './ShopCollection'
import { getProducts } from '@/lib/api'
import { getDisplayCurrency } from '@/lib/currency-server'
import { orderForShop } from '@/lib/shop-categories'

export const metadata: Metadata = {
  title: 'Shop',
}

export default async function ShopPage() {
  // Every live product, sold-out ones included: they keep their card (with a
  // "Sold Out" line) and sit at the end of the grid. Which products are live
  // at all is decided by the retail gate in lib/api.ts.
  const products = orderForShop(await getProducts(getDisplayCurrency()))

  return (
    <PageWrapper>
      <ShopCollection
        products={products}
        heading={
          // No visible page title (Elijah, 2026-11-17): the bar holds only the
          // FILTER control and the products start almost immediately. The h1
          // stays for screen readers and search.
          <h1 className="sr-only">Shop</h1>
        }
      />
    </PageWrapper>
  )
}
