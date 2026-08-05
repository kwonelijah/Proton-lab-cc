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
import type { JournalPost } from '@/types/journal'
import type { Currency } from '@/lib/currency'

// ─── MOCK DATA MODE (active) ─────────────────────────────────────────────────
import { products as mockProducts } from '@/data/products'
import { journalPosts as mockJournalPosts } from '@/data/journal'
import stockJson from '@/data/stock.json'
import stripeProducts from '@/data/stripe-products.json'

// ─── SHOPIFY MODE (swap to this later) ───────────────────────────────────────
// import {
//   getProducts as shopifyGetProducts,
//   getProductByHandle as shopifyGetProductByHandle,
//   getJournalPosts as shopifyGetJournalPosts,
//   getJournalPostByHandle as shopifyGetJournalPostByHandle,
// } from './shopify'

// ─── STOCK MERGE ─────────────────────────────────────────────────────────────
// Source of truth: inventory/stock.csv, compiled to data/stock.json by
// `npm run sync-stock`. A product with zero units across every size is
// marked availableForSale=false; individual sold-out sizes get the same.

type StockMap = Record<string, Record<string, number>>
const stock = stockJson as StockMap

// ─── SHOP DISPLAY GATE ───────────────────────────────────────────────────────
// SHOP_MODE controls what the whole site shows. Products not "live" disappear
// from the shop AND 404 on their direct /products/<handle> URL (getProductByHandle
// returns null → notFound()).
//   'empty'      — webshop shows NOTHING. Holding state between drops.
//   'summer2026' — ONLY the Summer 2026 collection is live; everything else 404s.
//   'legacy'     — the original catalogue (Summer 2026 hidden until its drop).
// To drop the new collection: change SHOP_MODE to 'summer2026' and deploy.
type ShopMode = 'empty' | 'summer2026' | 'legacy'
const SHOP_MODE: ShopMode = 'summer2026'

const SUMMER_2026_HANDLES = new Set([
  'sunset-jersey',
  'ocean-blue-jersey',
  'red-sky-jersey',
  'black-bib-shorts',
  'granite-bib-shorts',
  'white-bib-shorts',
  // 'white-cotton-socks',  // hidden for now — re-add when sock photos are ready
])

function isLive(handle: string): boolean {
  switch (SHOP_MODE) {
    case 'empty':      return false
    case 'summer2026': return SUMMER_2026_HANDLES.has(handle)
    case 'legacy':     return !SUMMER_2026_HANDLES.has(handle)
  }
}

// ─── EUR PRICE OVERLAY ───────────────────────────────────────────────────────
// EUR display prices come from the same file the backend charges from
// (data/stripe-products.json `eur` entries, created by scripts/stripe-sync.js
// from data/eur-prices.json) — products.ts stays GBP-only, so display and
// charge can never drift. A product without a EUR price keeps GBP; checkout
// then falls the whole session back to GBP too.

type PriceMapEntry = { unitAmount: number; eur?: { unitAmount: number } }
const priceMap = stripeProducts as unknown as Record<string, PriceMapEntry>

function withCurrency(product: Product, currency: Currency): Product {
  if (currency !== 'EUR') return product
  const eur = priceMap[product.handle]?.eur
  if (!eur) return product
  const amount = (eur.unitAmount / 100).toFixed(2)
  return {
    ...product,
    priceRange: { minVariantPrice: { amount, currencyCode: 'EUR' } },
    variants: {
      nodes: product.variants.nodes.map(v => ({
        ...v,
        price: { amount, currencyCode: 'EUR' },
      })),
    },
  }
}

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

// ─── EXPORTED FUNCTIONS ──────────────────────────────────────────────────────

export async function getProducts(currency: Currency = 'GBP'): Promise<Product[]> {
  return mockProducts.filter(p => isLive(p.handle)).map(p => withCurrency(withStock(p), currency))
  // return shopifyGetProducts()
}

export async function getProductByHandle(handle: string, currency: Currency = 'GBP'): Promise<Product | null> {
  if (!isLive(handle)) return null
  const p = mockProducts.find(p => p.handle === handle)
  return p ? withCurrency(withStock(p), currency) : null
  // return shopifyGetProductByHandle(handle)
}

// Club shops bypass the SHOP_MODE gate: they are password-protected and sell
// made-to-order kit, so their catalogue must stay reachable even when the
// retail shop hides those handles (the club PDP overrides availability itself).
export async function getClubProductByHandle(handle: string): Promise<Product | null> {
  const p = mockProducts.find(p => p.handle === handle)
  return p ? withStock(p) : null
}

export async function getJournalPosts(): Promise<JournalPost[]> {
  return mockJournalPosts
  // return shopifyGetJournalPosts()
}

export async function getJournalPostByHandle(handle: string): Promise<JournalPost | null> {
  return mockJournalPosts.find(p => p.handle === handle) ?? null
  // return shopifyGetJournalPostByHandle(handle)
}
