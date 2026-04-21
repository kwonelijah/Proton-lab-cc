/* eslint-disable */
// scripts/stripe-sync.js
// Reads PLPricelist.csv at the repo root and idempotently creates a Stripe
// Product + single Price per row. Writes handle -> { productId, priceId } to:
//   - data/stripe-products.json                 (repo root, source of truth)
//   - protonlab-backend/data/stripe-products.json  (bundled with backend deploy)
//
// Run: STRIPE_SECRET_KEY=sk_live_xxxxx node scripts/stripe-sync.js
//
// Idempotency:
//   - Products are matched via metadata.handle (Stripe Search API).
//   - Existing products have their name/metadata/active flag reconciled.
//   - If the current active price already has the target unit_amount, it is reused.
//     Otherwise a new price is created and the old one is deactivated.

const fs = require('fs');
const path = require('path');

// Load KEY=VALUE pairs from .env.local (gitignored) into process.env if present.
// Keeps secrets off disk-in-repo and off the command line. Does not overwrite
// variables that are already set in the environment.
function loadDotEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

// Resolve `stripe` from root node_modules first; fall back to the backend.
function loadStripe() {
  try {
    return require('stripe');
  } catch (_) {
    const backendPath = path.resolve(__dirname, '..', 'protonlab-backend', 'node_modules', 'stripe');
    return require(backendPath);
  }
}

const Stripe = loadStripe();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY env var.');
  console.error('Run: STRIPE_SECRET_KEY=sk_live_xxxxx node scripts/stripe-sync.js');
  process.exit(1);
}
const stripe = new Stripe(key);

const REPO_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(REPO_ROOT, 'PLPricelist.csv');
const OUT_ROOT = path.join(REPO_ROOT, 'data', 'stripe-products.json');
const OUT_BACKEND = path.join(REPO_ROOT, 'protonlab-backend', 'data', 'stripe-products.json');

function parseCsv(text) {
  // Minimal parser — the pricelist has no quoted commas.
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
}

function rowToProduct(row) {
  const name = row['Product'];
  const handle = row['Handle (URL slug)'];
  const category = row['Category'];
  const collection = row['Collection'];
  const priceGbp = parseFloat(row['Price (GBP)']);
  const notes = row['Notes'] || '';
  if (!name || !handle || Number.isNaN(priceGbp)) {
    throw new Error(`Invalid row: ${JSON.stringify(row)}`);
  }
  return {
    name,
    handle,
    category,
    collection,
    unitAmount: Math.round(priceGbp * 100),
    notes,
  };
}

async function findProductByHandle(handle) {
  const res = await stripe.products.search({
    query: `metadata['handle']:'${handle}'`,
    limit: 10,
  });
  return res.data.find(p => p.metadata && p.metadata.handle === handle) || null;
}

async function upsertProduct(spec) {
  const existing = await findProductByHandle(spec.handle);

  const desiredMetadata = {
    handle: spec.handle,
    category: spec.category || '',
    collection: spec.collection || '',
  };

  if (existing) {
    const metadataDrift =
      existing.metadata.category !== desiredMetadata.category ||
      existing.metadata.collection !== desiredMetadata.collection ||
      existing.metadata.handle !== desiredMetadata.handle;
    const nameDrift = existing.name !== spec.name;
    if (metadataDrift || nameDrift || !existing.active) {
      const updated = await stripe.products.update(existing.id, {
        name: spec.name,
        active: true,
        metadata: desiredMetadata,
      });
      return { product: updated, created: false, updated: true };
    }
    return { product: existing, created: false, updated: false };
  }

  const created = await stripe.products.create({
    name: spec.name,
    metadata: desiredMetadata,
  });
  return { product: created, created: true, updated: false };
}

async function upsertPrice(productId, unitAmount) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = prices.data.find(
    p => p.currency === 'gbp' && p.unit_amount === unitAmount && p.type === 'one_time'
  );
  if (match) return { price: match, created: false };

  const price = await stripe.prices.create({
    product: productId,
    currency: 'gbp',
    unit_amount: unitAmount,
  });

  // Deactivate any stale active prices with a different amount.
  await Promise.all(
    prices.data
      .filter(p => p.id !== price.id)
      .map(p => stripe.prices.update(p.id, { active: false }).catch(() => null))
  );
  return { price, created: true };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csv).map(rowToProduct);
  console.log(`Loaded ${rows.length} products from PLPricelist.csv`);

  const mapping = {};
  let createdCount = 0;
  let updatedCount = 0;
  let reusedCount = 0;

  for (const spec of rows) {
    const { product, created, updated } = await upsertProduct(spec);
    const { price, created: priceCreated } = await upsertPrice(product.id, spec.unitAmount);

    mapping[spec.handle] = {
      productId: product.id,
      priceId: price.id,
      name: spec.name,
      unitAmount: spec.unitAmount,
      currency: 'gbp',
      category: spec.category,
      collection: spec.collection,
    };

    let tag;
    if (created) { tag = 'CREATED'; createdCount++; }
    else if (updated) { tag = 'UPDATED'; updatedCount++; }
    else { tag = 'REUSED '; reusedCount++; }
    const priceTag = priceCreated ? 'new price' : 'reused price';
    console.log(`  [${tag}] ${spec.handle.padEnd(22)} £${(spec.unitAmount / 100).toFixed(2).padStart(7)}  ${product.id}  ${price.id}  (${priceTag})`);
  }

  writeJson(OUT_ROOT, mapping);
  writeJson(OUT_BACKEND, mapping);

  console.log('');
  console.log(`Done. created=${createdCount} updated=${updatedCount} reused=${reusedCount} total=${rows.length}`);
  console.log(`Wrote ${OUT_ROOT}`);
  console.log(`Wrote ${OUT_BACKEND}`);
}

main().catch(err => {
  console.error('stripe-sync failed:', err);
  process.exit(1);
});
