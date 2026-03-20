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

// ─── SHOPIFY MODE (swap to this later) ───────────────────────────────────────
// import {
//   getProducts as shopifyGetProducts,
//   getProductByHandle as shopifyGetProductByHandle,
//   getCollections as shopifyGetCollections,
//   getCollectionByHandle as shopifyGetCollectionByHandle,
//   getJournalPosts as shopifyGetJournalPosts,
//   getJournalPostByHandle as shopifyGetJournalPostByHandle,
// } from './shopify'

// ─── EXPORTED FUNCTIONS ──────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  return mockProducts
  // return shopifyGetProducts()
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  return mockProducts.find(p => p.handle === handle) ?? null
  // return shopifyGetProductByHandle(handle)
}

export async function getCollections(): Promise<Collection[]> {
  return mockCollections
  // return shopifyGetCollections()
}

export async function getCollectionByHandle(handle: string): Promise<Collection | null> {
  return mockCollections.find(c => c.handle === handle) ?? null
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
