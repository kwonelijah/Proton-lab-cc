#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'inventory', 'stock.csv')
const JSON_PATH = path.join(ROOT, 'data', 'stock.json')
const PRODUCTS_PATH = path.join(ROOT, 'data', 'products.ts')

function die(msg) {
  console.error(`\n[sync-stock] ✗ ${msg}\n`)
  process.exit(1)
}

if (!fs.existsSync(CSV_PATH)) die(`missing ${path.relative(ROOT, CSV_PATH)}`)
if (!fs.existsSync(PRODUCTS_PATH)) die(`missing ${path.relative(ROOT, PRODUCTS_PATH)}`)

const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '')
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0)

if (lines.length === 0) die('stock.csv is empty')

const header = lines[0].split(',').map(s => s.trim().toLowerCase())
const expected = ['handle', 'size', 'quantity']
if (header.join(',') !== expected.join(',')) {
  die(`stock.csv header must be "${expected.join(',')}" (got "${header.join(',')}")`)
}

const stock = {}
const seen = new Set()
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',').map(s => s.trim())
  if (cols.length !== 3) die(`line ${i + 1}: expected 3 columns, got ${cols.length}`)
  const [handle, size, qtyStr] = cols
  if (!handle || !size) die(`line ${i + 1}: empty handle or size`)
  const key = `${handle}::${size}`
  if (seen.has(key)) die(`line ${i + 1}: duplicate row for ${handle} / ${size}`)
  seen.add(key)
  const qty = Number.parseInt(qtyStr, 10)
  if (!Number.isFinite(qty) || qty < 0 || String(qty) !== qtyStr) {
    die(`line ${i + 1}: quantity must be a non-negative integer (got "${qtyStr}")`)
  }
  if (!stock[handle]) stock[handle] = {}
  stock[handle][size] = qty
}

// Cross-check against products.ts — naive text parse, catches typos.
const src = fs.readFileSync(PRODUCTS_PATH, 'utf8')

// Split into per-product blocks by top-level `id:` anchors.
const productBlocks = src.split(/(?=id:\s*'prod_)/).slice(1)
const catalogSizes = {} // handle -> Set<size>
for (const block of productBlocks) {
  const handleMatch = block.match(/handle:\s*'([^']+)'/)
  if (!handleMatch) continue
  const handle = handleMatch[1]
  const set = new Set()

  // `sizes('id', 'price'[, ['2XL', ...]])` → XS–XL plus any extras.
  const sizesCall = block.match(/variants:\s*sizes\(\s*'[^']+'\s*,\s*'[^']+'(?:\s*,\s*\[([^\]]*)\])?\s*\)/)
  if (sizesCall) {
    ;['XS', 'S', 'M', 'L', 'XL'].forEach(s => set.add(s))
    const extraArgs = sizesCall[1]
    if (extraArgs) {
      for (const m of extraArgs.matchAll(/'([^']+)'/g)) set.add(m[1])
    }
  }

  // Explicit `selectedOptions: [{ name: 'Size', value: 'X' }]` (and friends).
  for (const m of block.matchAll(/name:\s*'Size'\s*,\s*value:\s*'([^']+)'/g)) {
    set.add(m[1])
  }

  if (set.size > 0) catalogSizes[handle] = set
}

const missingFromCatalog = Object.keys(stock).filter(h => !catalogSizes[h])
if (missingFromCatalog.length > 0) {
  die(`stock.csv references handles not in data/products.ts: ${missingFromCatalog.join(', ')}`)
}

const badSizes = []
for (const [handle, bySize] of Object.entries(stock)) {
  const valid = catalogSizes[handle]
  for (const size of Object.keys(bySize)) {
    if (!valid.has(size)) badSizes.push(`${handle}/${size}`)
  }
}
if (badSizes.length > 0) {
  die(
    `stock.csv references sizes not defined in data/products.ts: ${badSizes.join(', ')}\n` +
      `  (add the size to the product's variants or remove the row)`
  )
}

const missingFromStock = Object.keys(catalogSizes).filter(h => !stock[h])
if (missingFromStock.length > 0) {
  console.warn(
    `[sync-stock] ⚠ catalog handles with no stock row (will be hidden from shop): ${missingFromStock.join(', ')}`
  )
}

fs.writeFileSync(JSON_PATH, JSON.stringify(stock, null, 2) + '\n')

const totalUnits = Object.values(stock).reduce(
  (sum, bySize) => sum + Object.values(bySize).reduce((s, q) => s + q, 0),
  0
)
const inStockProducts = Object.values(stock).filter(bySize =>
  Object.values(bySize).some(q => q > 0)
).length

console.log(
  `[sync-stock] ✓ wrote ${path.relative(ROOT, JSON_PATH)} — ` +
    `${inStockProducts} products in stock, ${totalUnits} total units`
)
