import type { Product } from '@/types/product'

export function formatPrice(amount: string, currencyCode: string): string {
  // en-IE keeps the symbol-first style (€110) for EUR; en-GB would too, but
  // being explicit keeps the rendering deliberate per currency.
  return new Intl.NumberFormat(currencyCode === 'EUR' ? 'en-IE' : 'en-GB', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Every size of a product with whether it has units on hand, in variant order
// (e.g. [{ label: 'XS', inStock: true }, ...]). The label is derived the way
// lib/api.ts withStock keys stock: the Size option value, falling back to the
// variant title.
export function sizeAvailability(product: Product): { label: string; inStock: boolean }[] {
  return product.variants.nodes.map(v => ({
    label: v.selectedOptions.find(o => o.name === 'Size')?.value ?? v.title,
    inStock: v.availableForSale,
  }))
}
