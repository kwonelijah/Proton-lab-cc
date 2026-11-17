import type { Product } from '@/types/product'

// Shop FILTER categories. A product belongs to a category when it carries ANY
// of the category's tags (data/products.ts `tags`). Order here = order in the
// filter list. Add a row and every live product with one of its tags joins
// the filter automatically; a category with no live products is not offered.
export interface ShopCategory {
  key: string
  label: string
  tags: string[]
}

export const ALL_CATEGORY = 'all'

export const SHOP_CATEGORIES: ShopCategory[] = [
  { key: 'jerseys', label: 'Jerseys', tags: ['jersey'] },
  { key: 'bib-shorts', label: 'Bib Shorts', tags: ['shorts', 'bib'] },
  { key: 'socks', label: 'Socks', tags: ['socks'] },
]

export function matchesCategory(product: Product, key: string): boolean {
  if (key === ALL_CATEGORY) return true
  const category = SHOP_CATEGORIES.find(c => c.key === key)
  return !!category && category.tags.some(tag => product.tags.includes(tag))
}

// Only the categories that have at least one product in the list.
export function availableCategories(products: Product[]): ShopCategory[] {
  return SHOP_CATEGORIES.filter(c => products.some(p => matchesCategory(p, c.key)))
}

// In-stock products first, sold-out ones last; catalogue order kept within
// each group. Sold-out products stay listed (with a "Sold Out" line) rather
// than disappearing from the shop.
export function orderForShop(products: Product[]): Product[] {
  return [
    ...products.filter(p => p.availableForSale),
    ...products.filter(p => !p.availableForSale),
  ]
}
