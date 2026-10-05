// scripts/stripe-audit.mjs
// Read-only consistency check across every place a product or price is defined,
// ending with the live Stripe account. Run it after `node scripts/stripe-sync.js`
// and before pushing any product, price or club-shop change:
//
//   npm run audit:stripe
//
// Checks
//   1. PLPricelist.csv ↔ data/stripe-products.json ↔ data/products.ts handles & amounts
//   2. protonlab-backend/data/stripe-products.json is byte-identical to the root copy
//   3. every club tile in data/clubs.ts resolves to a catalogue handle that has a
//      club price for that club in both club-prices.json and the stripe map, and
//      the £ shown on the tile matches it
//   4. every price id in the map is active in Stripe with the same amount/currency;
//      every product id is active
//
// Exit code 1 when anything is wrong (so it can gate a push); pricelist handles
// with no catalogue product are reported as warnings only (they can't be sold).
//
// Needs STRIPE_SECRET_KEY — read from .env.local like scripts/stripe-sync.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function stripeKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  const env = fs.existsSync(path.join(ROOT, '.env.local')) ? read('.env.local') : '';
  const m = env.match(/^STRIPE_SECRET_KEY=(.+)$/m);
  if (!m) throw new Error('STRIPE_SECRET_KEY not set and not in .env.local');
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const warnings = [];

// ─── 1. static sources ──────────────────────────────────────────────────────
const map = JSON.parse(read('data/stripe-products.json'));
const backendRaw = read('protonlab-backend/data/stripe-products.json');
const clubPrices = JSON.parse(read('data/club-prices.json'));
const pricelist = Object.fromEntries(
  read('PLPricelist.csv').trim().split(/\r?\n/).slice(1)
    .map((l) => l.split(','))
    .map((c) => [c[2].trim(), parseFloat(c[3])])
);
const productsTs = read('data/products.ts');
const catalogHandles = [...productsTs.matchAll(/^\s*id: 'prod_\d+', handle: '([a-z0-9-]+)'/gm)].map((m) => m[1]);

console.log(`pricelist ${Object.keys(pricelist).length} handles | stripe map ${Object.keys(map).length} | catalogue ${catalogHandles.length}`);

if (backendRaw !== read('data/stripe-products.json')) issues.push('protonlab-backend/data/stripe-products.json differs from data/stripe-products.json — re-run scripts/stripe-sync.js');

for (const [h, gbp] of Object.entries(pricelist)) {
  if (!map[h]) issues.push(`pricelist handle "${h}" missing from the stripe map (run stripe-sync)`);
  else if (map[h].unitAmount !== Math.round(gbp * 100)) issues.push(`${h}: pricelist £${gbp} but stripe map ${map[h].unitAmount}p (run stripe-sync)`);
  if (!catalogHandles.includes(h)) warnings.push(`pricelist handle "${h}" has no product in data/products.ts (cannot be sold anywhere)`);
}
for (const h of Object.keys(map)) if (pricelist[h] === undefined) issues.push(`stripe map handle "${h}" is not in PLPricelist.csv`);
for (const h of catalogHandles) if (!map[h]) issues.push(`catalogue product "${h}" has no Stripe price — add it to PLPricelist.csv and run stripe-sync`);

// ─── 2. club shops ──────────────────────────────────────────────────────────
const clubsTs = read('data/clubs.ts');
const clubBlocks = [...clubsTs.matchAll(/handle: '([a-z0-9-]+)',\s*\n\s*name: '([^']+)',[\s\S]*?products: \[([\s\S]*?)\n\s*\],\n\s*\}/g)];
let tiles = 0;
for (const [, club, , body] of clubBlocks) {
  const prods = [...body.matchAll(/\{ name: '([^']+)', handle: '([a-z0-9-]+)'([\s\S]*?)price: '£([\d.]+)'/g)];
  for (const [, pname, handle, mid, shown] of prods) {
    tiles++;
    const cat = (mid.match(/catalogHandle: '([a-z0-9-]+)'/) || [])[1] || handle;
    const entry = map[cat];
    const want = clubPrices[club]?.[cat];
    if (!entry) { issues.push(`${club} / ${pname}: catalogue handle "${cat}" missing from the stripe map`); continue; }
    if (want === undefined) {
      if (Math.round(parseFloat(shown) * 100) !== entry.unitAmount) issues.push(`${club} / ${pname}: no club price override and tile shows £${shown} but retail is ${entry.unitAmount}p`);
      else warnings.push(`${club} / ${pname}: sold at retail price (no override in club-prices.json)`);
      continue;
    }
    const cp = entry.clubPrices?.[club];
    if (!cp) issues.push(`${club} / ${pname}: club-prices.json says £${want} but the stripe map has no club price (run stripe-sync)`);
    else if (cp.unitAmount !== Math.round(want * 100)) issues.push(`${club} / ${pname}: club-prices.json £${want} vs stripe map ${cp.unitAmount}p (run stripe-sync)`);
    if (Math.round(parseFloat(shown) * 100) !== Math.round(want * 100)) issues.push(`${club} / ${pname}: tile shows £${shown} but the club price is £${want}`);
  }
}
console.log(`club tiles checked: ${tiles} across ${clubBlocks.length} clubs`);
for (const [club, prices] of Object.entries(clubPrices)) {
  if (!clubBlocks.some(([, h]) => h === club)) warnings.push(`club-prices.json has prices for "${club}" but data/clubs.ts has no such shop (orphaned Stripe prices — archive via stripe-sync --prune)`);
  for (const h of Object.keys(prices)) if (!map[h]) issues.push(`club-prices.json: "${club}" prices unknown handle "${h}"`);
}

// ─── 3. live Stripe ─────────────────────────────────────────────────────────
const H = { Authorization: 'Bearer ' + stripeKey() };
async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: H });
    if (r.status !== 429) return r.json();
    await sleep(1500 * (attempt + 1));
  }
  return { error: { message: 'rate limited' } };
}
const priceChecks = [];
for (const [h, e] of Object.entries(map)) {
  priceChecks.push([`${h} retail`, e.priceId, e.unitAmount, 'gbp']);
  if (e.eur) priceChecks.push([`${h} eur`, e.eur.priceId, e.eur.unitAmount, 'eur']);
  for (const [c, cp] of Object.entries(e.clubPrices || {})) priceChecks.push([`${h} club:${c}`, cp.priceId, cp.unitAmount, 'gbp']);
}
let priceOk = 0;
for (const [label, id, amt, cur] of priceChecks) {
  const p = await get(`https://api.stripe.com/v1/prices/${id}`);
  if (p.error) issues.push(`${label}: Stripe — ${p.error.message}`);
  else if (!p.active) issues.push(`${label}: price ${id} is archived in Stripe`);
  else if (p.unit_amount !== amt || p.currency !== cur) issues.push(`${label}: Stripe ${p.unit_amount} ${p.currency} vs map ${amt} ${cur}`);
  else priceOk++;
  await sleep(120);
}
console.log(`live prices verified: ${priceOk}/${priceChecks.length}`);
const productIds = [...new Set(Object.values(map).map((e) => e.productId))];
let productOk = 0;
for (const id of productIds) {
  const p = await get(`https://api.stripe.com/v1/products/${id}`);
  if (p.error) issues.push(`product ${id}: Stripe — ${p.error.message}`);
  else if (!p.active) issues.push(`product ${id} (${p.name}) is inactive in Stripe`);
  else productOk++;
  await sleep(120);
}
console.log(`live products active: ${productOk}/${productIds.length}`);

// ─── report ─────────────────────────────────────────────────────────────────
if (warnings.length) console.log(`\nWARNINGS (${warnings.length}):\n- ` + warnings.join('\n- '));
if (issues.length) {
  console.log(`\nISSUES (${issues.length}):\n- ` + issues.join('\n- '));
  process.exit(1);
}
console.log('\nNO ISSUES — pricelist, catalogue, club shops, price maps and Stripe all agree');
