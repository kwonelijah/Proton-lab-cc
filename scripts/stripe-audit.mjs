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
//   4. the delivery-mode flags on each club in data/clubs.ts (centralDelivery /
//      collectionOption) match the lists checkout trusts in
//      protonlab-backend/config/shipping.js (CLUB_DELIVERY_CLUBS /
//      COLLECTION_OPTION_CLUBS), and no club is in both
//   5. every price id in the map is active in Stripe with the same amount/currency;
//      every product id is active
//
// Exit code 1 when anything is wrong (so it can gate a push); pricelist handles
// with no catalogue product are reported as warnings only (they can't be sold).
//
// Needs STRIPE_SECRET_KEY — read from .env.local like scripts/stripe-sync.js.
// `--static` runs checks 1–4 only (no key, no network) — a fast pre-push check.

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
const STATIC_ONLY = process.argv.includes('--static');
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

// ─── 3. club delivery modes ─────────────────────────────────────────────────
// The site's flags only drive display; the backend lists decide what checkout
// charges. If they drift a shop can hide the address while postage is still
// charged (or the reverse), so both directions are checked.
{
  const shippingJs = read('protonlab-backend/config/shipping.js');
  const listOf = (name) => {
    const m = shippingJs.match(new RegExp(`export const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
    if (!m) issues.push(`protonlab-backend/config/shipping.js: could not find ${name}`);
    return new Set(m ? [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]) : []);
  };
  const modes = [
    ['centralDelivery', 'CLUB_DELIVERY_CLUBS', listOf('CLUB_DELIVERY_CLUBS')],
    ['collectionOption', 'COLLECTION_OPTION_CLUBS', listOf('COLLECTION_OPTION_CLUBS')],
  ];
  const flagged = {};
  for (const [block, handle] of clubBlocks) {
    const head = block.slice(0, block.indexOf('products:'));
    flagged[handle] = modes.filter(([flag]) => new RegExp(`${flag}:\\s*true`).test(head)).map(([flag]) => flag);
    if (flagged[handle].length > 1) issues.push(`${handle}: data/clubs.ts sets both ${flagged[handle].join(' and ')} — a club has at most one delivery mode`);
  }
  for (const [flag, list, set] of modes) {
    for (const [, handle] of clubBlocks) {
      if (flagged[handle].includes(flag) && !set.has(handle)) issues.push(`${handle}: ${flag} in data/clubs.ts but not in ${list} — checkout will still charge postage`);
    }
    for (const handle of set) {
      if (!flagged[handle]?.includes(flag)) issues.push(`${handle}: in ${list} but data/clubs.ts has no ${flag} flag (or no such shop) — the site shows postage the backend won't charge`);
    }
  }
  const [, , clubSet] = modes[0];
  const [, , collectionSet] = modes[1];
  for (const h of clubSet) if (collectionSet.has(h)) issues.push(`${h}: in both CLUB_DELIVERY_CLUBS and COLLECTION_OPTION_CLUBS`);
  console.log(`club delivery modes: ${clubSet.size} club-delivery, ${collectionSet.size} collection-option — flags checked against the backend lists`);
}

// ─── 4. live Stripe ─────────────────────────────────────────────────────────
if (STATIC_ONLY) {
  console.log('live Stripe checks skipped (--static)');
  report();
}
const H = { Authorization: 'Bearer ' + stripeKey() };
async function get(url) {
  let last = 'rate limited';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: H });
      if (r.status !== 429) return r.json();
    } catch (err) {
      // Transient timeouts must not abort the whole audit — retry, then report.
      last = `network error (${err.cause?.code || err.message})`;
    }
    await sleep(1500 * (attempt + 1));
  }
  return { error: { message: last } };
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
report();
function report() {
  if (warnings.length) console.log(`\nWARNINGS (${warnings.length}):\n- ` + warnings.join('\n- '));
  if (issues.length) {
    console.log(`\nISSUES (${issues.length}):\n- ` + issues.join('\n- '));
    process.exit(1);
  }
  console.log(STATIC_ONLY
    ? '\nNO ISSUES — pricelist, catalogue, club shops and price maps agree (Stripe not checked)'
    : '\nNO ISSUES — pricelist, catalogue, club shops, price maps and Stripe all agree');
  process.exit(0);
}
