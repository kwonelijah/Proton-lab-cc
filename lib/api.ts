// ─────────────────────────────────────────────────────────────────────────────
// API ADAPTER LAYER
// ─────────────────────────────────────────────────────────────────────────────
//
// All components import data exclusively from THIS file — never directly from
// /data/* or /lib/shopify.ts.
//
// TO SWITCH TO SHOPIFY:
//   1. Comment out the "MOCK DATA MODE" imports below
//   2. Uncomment the "SHOPIFY MODE" imports
//   3. All 10 pages and every component continue to work with zero changes
//
// ─────────────────────────────────────────────────────────────────────────────

import type { Product } from '@/types/product'
import type { Collection } from '@/types/collection'
import type { JournalPost } from '@/types/journal'

// ─── MOCK DATA MODE (active) ─────────────────────────────────────────────────
import { products as mockProducts } from '@/data/products'
import { collections as mockCollections } from '@/data/collections'
import { journalPosts as mockJournalPosts } from '@/data/journal'
import stockJson from '@/data/stock.json'

// ─── SHOPIFY MODE (swap to this later) ───────────────────────────────────────
// import {
//   getProducts as shopifyGetProducts,
//   getProductByHandle as shopifyGetProductByHandle,
//   getCollections as shopifyGetCollections,
//   getCollectionByHandle as shopifyGetCollectionByHandle,
//   getJournalPosts as shopifyGetJournalPosts,
//   getJournalPostByHandle as shopifyGetJournalPostByHandle,
// } from './shopify'

// ─── STOCK MERGE ─────────────────────────────────────────────────────────────
// Source of truth: inventory/stock.csv, compiled to data/stock.json by
// `npm run sync-stock`. A product with zero units across every size is
// marked availableForSale=false; individual sold-out sizes get the same.

type StockMap = Record<string, Record<string, number>>
const stock = stockJson as StockMap

function withStock(product: Product): Product {
  const bySize = stock[product.handle] ?? {}
  const variants = product.variants.nodes.map(v => {
    const sizeLabel = v.selectedOptions.find(o => o.name === 'Size')?.value ?? v.title
    const qty = bySize[sizeLabel] ?? 0
    return { ...v, quantity: qty, availableForSale: qty > 0 }
  })
  const anyInStock = variants.some(v => (v.quantity ?? 0) > 0)
  return {
    ...product,
    availableForSale: anyInStock,
    variants: { nodes: variants },
  }
}

function mergeCollection(col: Collection): Collection {
  return {
    ...col,
    products: { nodes: col.products.nodes.map(withStock) },
  }
}

// ─── EXPORTED FUNCTIONS ──────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  return mockProducts.map(withStock)
  // return shopifyGetProducts()
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const p = mockProducts.find(p => p.handle === handle)
  return p ? withStock(p) : null
  // return shopifyGetProductByHandle(handle)
}

export async function getCollections(): Promise<Collection[]> {
  return mockCollections.map(mergeCollection)
  // return shopifyGetCollections()
}

export async function getCollectionByHandle(handle: string): Promise<Collection | null> {
  const c = mockCollections.find(c => c.handle === handle)
  return c ? mergeCollection(c) : null
  // return shopifyGetCollectionByHandle(handle)
}

export async function getJournalPosts(): Promise<JournalPost[]> {
  return mockJournalPosts
  // return shopifyGetJournalPosts()
}

export async function getJournalPostByHandle(handle: string): Promise<JournalPost | null> {
  return mockJournalPosts.find(p => p.handle === handle) ?? null
  // return shopifyGetJournalPostByHandle(handle)
}
