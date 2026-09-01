// lib/stock.js
// Stock movements against inventory/stock.csv in the website repo, written
// through the GitHub Contents API. The committed CSV is the single source of
// truth: the site's prebuild step (scripts/sync-stock.mjs) recompiles it to
// data/stock.json and Vercel redeploys the site on every push to main.
//
// BUILD-SAFETY INVARIANT — the reason this module can never break the site:
// we never add, remove, rename, or reorder CSV rows. Only the quantity field
// of EXISTING rows is rewritten, clamped to non-negative integers, with the
// exact header and \n line endings preserved. sync-stock.mjs dies at build
// time on unknown handles/sizes — since today's CSV builds green, every
// quantity-only mutation also builds green. Movements that target a
// handle::size not present in the CSV are skipped and reported (this also
// naturally excludes made-to-order club kit, which never has stock rows).
//
// Concurrency: the Contents API PUT is compare-and-swap on the file sha, so a
// concurrent writer gets a 409/422 and nothing corrupts. Because movements
// are signed deltas (not absolute quantities), applyAndCommit() simply
// re-reads and replays on conflict — always correct.

const OWNER = 'kwonelijah';
const REPO = 'Proton-lab-cc';
const FILE_PATH = 'inventory/stock.csv';
const BRANCH = 'main';
const HEADER = 'handle,size,quantity';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
const MAX_COMMIT_RETRIES = 3;

function ghHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN_MISSING: set GITHUB_TOKEN in the environment');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'protonlab-backend-stock',
  };
}

export function rowKey(handle, size) {
  return `${handle}::${size}`;
}

// Parses the CSV text into ordered rows. Tolerates BOM and CRLF; rejects a
// wrong header or malformed rows loudly rather than guessing.
export function parseStockCsv(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  if (lines[0] !== HEADER) {
    throw new Error(`STOCK_CSV_BAD_HEADER: expected "${HEADER}", got "${lines[0]}"`);
  }
  return lines.slice(1).map((line, i) => {
    const parts = line.split(',');
    const quantity = Number(parts[2]);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`STOCK_CSV_BAD_ROW: line ${i + 2}: "${line}"`);
    }
    return { handle: parts[0], size: parts[1], quantity };
  });
}

export function serializeStockCsv(rows) {
  return [HEADER, ...rows.map((r) => `${r.handle},${r.size},${r.quantity}`)].join('\n') + '\n';
}

// Reads the current CSV from GitHub. Returns { rows, sha, text }.
export async function readStock() {
  const res = await fetch(`${API}?ref=${BRANCH}`, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GITHUB_READ_FAILED: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const text = Buffer.from(data.content, 'base64').toString('utf8');
  return { rows: parseStockCsv(text), sha: data.sha, text };
}

// Reads any file from the website repo (same token, same branch) — used by
// lib/clubs.js for data/clubs.ts. Read-only; commits stay stock.csv-only.
export async function readRepoFile(filePath) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GITHUB_READ_FAILED: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return { text: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

// Pure. Applies signed movements [{handle, size, qty}] (negative = stock out)
// to a copy of rows. Duplicate handle::size movements are aggregated first.
// Unknown keys are skipped with a reason; quantities clamp at 0.
// Returns { rows, applied, skipped, clamped, changed }.
export function applyMovements(rows, movements) {
  const index = new Map(rows.map((r, i) => [rowKey(r.handle, r.size), i]));
  const deltas = new Map();
  const skipped = [];
  for (const m of movements) {
    const qty = Number(m?.qty);
    if (!m?.handle || !m?.size || !Number.isInteger(qty)) {
      skipped.push({ movement: m, reason: 'malformed movement' });
      continue;
    }
    const key = rowKey(m.handle, m.size);
    if (!index.has(key)) {
      skipped.push({ movement: { handle: m.handle, size: m.size, qty }, reason: 'no such handle::size in stock.csv' });
      continue;
    }
    deltas.set(key, (deltas.get(key) || 0) + qty);
  }

  const next = rows.map((r) => ({ ...r }));
  const applied = [];
  const clamped = [];
  for (const [key, delta] of deltas) {
    if (delta === 0) continue;
    const row = next[index.get(key)];
    const before = row.quantity;
    let after = before + delta;
    if (after < 0) {
      clamped.push({ handle: row.handle, size: row.size, requested: delta, before, after: 0 });
      after = 0;
    }
    row.quantity = after;
    applied.push({ handle: row.handle, size: row.size, delta, before, after });
  }
  return { rows: next, applied, skipped, clamped, changed: applied.length > 0 };
}

// Build-safety tripwire: identical key set AND order, all quantities
// non-negative integers. Throws on any violation.
export function validateRows(originalRows, nextRows) {
  if (nextRows.length !== originalRows.length) {
    throw new Error('STOCK_VALIDATE_FAILED: row count changed');
  }
  for (let i = 0; i < nextRows.length; i++) {
    const a = originalRows[i];
    const b = nextRows[i];
    if (a.handle !== b.handle || a.size !== b.size) {
      throw new Error(`STOCK_VALIDATE_FAILED: row ${i} key changed (${rowKey(a.handle, a.size)} → ${rowKey(b.handle, b.size)})`);
    }
    if (!Number.isInteger(b.quantity) || b.quantity < 0) {
      throw new Error(`STOCK_VALIDATE_FAILED: row ${i} quantity ${b.quantity}`);
    }
  }
}

async function commitStock(text, sha, message) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(text, 'utf8').toString('base64'),
      sha,
      branch: BRANCH,
    }),
  });
  if (res.status === 409 || res.status === 422) {
    return { conflict: true };
  }
  if (!res.ok) {
    throw new Error(`GITHUB_COMMIT_FAILED: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return { conflict: false, commitSha: data.commit?.sha || null };
}

// Read → apply → validate → commit, retrying on sha conflicts with a fresh
// read (movements are deltas, so replay is always correct). A run where no
// movement lands on an existing row commits nothing and reports noop.
export async function applyAndCommit(movements, message) {
  let last = null;
  for (let attempt = 1; attempt <= MAX_COMMIT_RETRIES; attempt++) {
    const { rows, sha } = await readStock();
    const result = applyMovements(rows, movements);
    last = result;
    if (!result.changed) {
      return { ...report(result), noop: true, commitSha: null };
    }
    validateRows(rows, result.rows);
    const put = await commitStock(serializeStockCsv(result.rows), sha, message);
    if (!put.conflict) {
      return { ...report(result), noop: false, commitSha: put.commitSha };
    }
    console.warn(`Stock commit conflict (attempt ${attempt}/${MAX_COMMIT_RETRIES}) — re-reading`);
  }
  throw new Error(`STOCK_COMMIT_CONFLICT: gave up after ${MAX_COMMIT_RETRIES} attempts (${last?.applied.length ?? 0} movements pending)`);
}

function report({ applied, skipped, clamped }) {
  return { applied, skipped, clamped };
}
