// ─────────────────────────────────────────────────────────────────────────────
// SHOPIFY STOREFRONT API — STUB
// ─────────────────────────────────────────────────────────────────────────────
//
// This file contains all Shopify integration code, ready to be activated.
//
// TO ACTIVATE SHOPIFY:
//   1. npm install @shopify/storefront-api-client
//   2. Add to .env.local:
//        SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
//        SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-public-storefront-token
//   3. Uncomment everything below
//   4. In /lib/api.ts, switch the import source (see instructions there)
//
// ─────────────────────────────────────────────────────────────────────────────

/*
import { createStorefrontApiClient } from '@shopify/storefront-api-client'
import type { Product } from '@/types/product'
import type { Collection } from '@/types/collection'
import type { JournalPost } from '@/types/journal'

const client = createStorefrontApiClient({
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN!,
  apiVersion: '2024-01',
  publicAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
})

// ─── FRAGMENTS ───────────────────────────────────────────────────────────────

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    tags
    featuredImage { id url altText width height }
    images(first: 10) { nodes { id url altText width height } }
    variants(first: 20) {
      nodes {
        id
        title
        availableForSale
        price { amount currencyCode }
        selectedOptions { name value }
      }
    }
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    collections(first: 3) {
      nodes { handle title }
    }
  }
`

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  const { data } = await client.request(`
    query GetProducts {
      products(first: 50) {
        nodes { ...ProductFields }
      }
    }
    ${PRODUCT_FRAGMENT}
  `)
  return data.products.nodes
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const { data } = await client.request(`
    query GetProduct($handle: String!) {
      product(handle: $handle) { ...ProductFields }
    }
    ${PRODUCT_FRAGMENT}
  `, { variables: { handle } })
  return data.product ?? null
}

// ─── COLLECTIONS ─────────────────────────────────────────────────────────────

export async function getCollections(): Promise<Collection[]> {
  const { data } = await client.request(`
    query GetCollections {
      collections(first: 20) {
        nodes {
          id handle title description descriptionHtml
          image { url altText }
          products(first: 12) { nodes { ...ProductFields } }
        }
      }
    }
    ${PRODUCT_FRAGMENT}
  `)
  return data.collections.nodes
}

export async function getCollectionByHandle(handle: string): Promise<Collection | null> {
  const { data } = await client.request(`
    query GetCollection($handle: String!) {
      collection(handle: $handle) {
        id handle title description descriptionHtml
        image { url altText }
        products(first: 24) { nodes { ...ProductFields } }
      }
    }
    ${PRODUCT_FRAGMENT}
  `, { variables: { handle } })
  return data.collection ?? null
}

// ─── JOURNAL (Shopify Blog) ───────────────────────────────────────────────────
// Shopify blogs use the Blogs API, not Storefront GraphQL.
// Map articles to JournalPost interface.

export async function getJournalPosts(): Promise<JournalPost[]> {
  const { data } = await client.request(`
    query GetBlogArticles {
      blog(handle: "journal") {
        articles(first: 20, sortKey: PUBLISHED_AT, reverse: true) {
          nodes {
            id handle title excerpt contentHtml
            publishedAt
            author { name }
            image { url altText }
            tags
          }
        }
      }
    }
  `)
  return data.blog?.articles.nodes.map((a: any) => ({
    ...a,
    content: '',
  })) ?? []
}

export async function getJournalPostByHandle(handle: string): Promise<JournalPost | null> {
  const { data } = await client.request(`
    query GetArticle($handle: String!) {
      blog(handle: "journal") {
        articleByHandle(handle: $handle) {
          id handle title excerpt contentHtml
          publishedAt
          author { name }
          image { url altText }
          tags
        }
      }
    }
  `, { variables: { handle } })
  const article = data.blog?.articleByHandle
  if (!article) return null
  return { ...article, content: '' }
}
*/

export {}
