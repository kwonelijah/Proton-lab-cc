// Product types mirror Shopify Storefront API GraphQL shape exactly.
// When Shopify is connected, these interfaces will match the API response
// with zero modification required.

export interface ProductImage {
  id: string
  url: string
  altText: string | null
  width: number
  height: number
}

export interface ProductVariant {
  id: string
  title: string
  availableForSale: boolean
  // Units on hand — populated by lib/api.ts from inventory/stock.csv.
  // Absent on the Shopify-shaped source; added during merge.
  quantity?: number
  price: {
    // Shopify returns prices as strings e.g. "149.00"
    amount: string
    currencyCode: string
  }
  selectedOptions: {
    name: string
    value: string
  }[]
}

export interface Product {
  id: string
  handle: string // URL slug — matches Shopify's 'handle' field
  title: string
  description: string
  descriptionHtml?: string
  featuredImage: ProductImage
  // Shopify uses 'nodes' inside GraphQL connections
  images: {
    nodes: ProductImage[]
  }
  variants: {
    nodes: ProductVariant[]
  }
  priceRange: {
    minVariantPrice: {
      amount: string
      currencyCode: string
    }
  }
  collections?: {
    nodes: { handle: string; title: string }[]
  }
  tags: string[]
  availableForSale: boolean
  bullets?: string[]
  seo?: {
    title: string
    description: string
    keywords: string
  }
}
