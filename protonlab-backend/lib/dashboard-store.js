// lib/dashboard-store.js
// Server-side state for the hosted order dashboard — everything that used to
// live only in one browser's localStorage. One private Vercel Blob per
// section (same store + token as lib/bank-orders.js):
//
//   dashboard/state/<section>.json = {version, updatedAt, updatedBy, data}
//
// Writes are optimistic: the client sends the `baseVersion` it last read; a
// mismatch — or a lost race, caught by the blob ETag (`ifMatch`) — answers
// {conflict:true, current} and the client merges and retries. Nothing is ever
// overwritten silently.
//
// backupAll() (run by the nightly stock-sync cron) copies every section to
// dashboard/backups/YYYY-MM-DD/<section>.json and keeps BACKUP_DAYS days.

import { put, get, list, del } from '@vercel/blob';

export const SECTIONS = ['orders', 'manual', 'planner', 'clubshops', 'retailcosts', 'analytics', 'stockAliases'];
// Sections that are arrays of records with `id` + `updated` (merged per record).
export const RECORD_SECTIONS = ['orders', 'manual'];
export const STATE_PREFIX = 'dashboard/state/';
export const BACKUP_PREFIX = 'dashboard/backups/';
export const BACKUP_DAYS = 30;
export const MAX_SECTION_BYTES = 3.5 * 1024 * 1024; // under Vercel's 4.5 MB request cap

const OPTS = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };
const pathOf = (s) => `${STATE_PREFIX}${s}.json`;

export const isSection = (s) => SECTIONS.includes(s);

async function readRaw(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return { text, etag: r.blob?.etag || null };
}

export async function readSection(section) {
  const raw = await readRaw(pathOf(section));
  if (!raw) return null;
  return { ...JSON.parse(raw.text), etag: raw.etag };
}

// → { orders: {version, updatedAt, updatedBy, data} | null, … }
export async function readAll() {
  const docs = await Promise.all(SECTIONS.map((s) => readSection(s)));
  const out = {};
  SECTIONS.forEach((s, i) => {
    const d = docs[i];
    out[s] = d ? { version: d.version, updatedAt: d.updatedAt, updatedBy: d.updatedBy, data: d.data } : null;
  });
  return out;
}

const isPrecondition = (err) =>
  err?.name === 'BlobPreconditionFailedError' || /precondition/i.test(String(err?.message || ''));
const isExists = (err) => /already exists/i.test(String(err?.message || ''));

// → {ok:true, version, updatedAt} | {conflict:true, current} | {error, status}
export async function saveSection(section, { baseVersion, data, user, force = false }) {
  if (!isSection(section)) return { error: `Unknown section "${String(section).slice(0, 40)}"`, status: 400 };
  if (data === undefined) return { error: 'Missing data', status: 400 };
  const now = new Date().toISOString();
  const cur = await readSection(section);
  const curVersion = cur ? cur.version : 0;
  if (!force && Number(baseVersion || 0) !== curVersion) {
    return { conflict: true, current: cur ? { version: cur.version, updatedAt: cur.updatedAt, updatedBy: cur.updatedBy, data: cur.data } : null };
  }
  const doc = { version: curVersion + 1, updatedAt: now, updatedBy: user || 'unknown', data };
  const body = JSON.stringify(doc);
  if (body.length > MAX_SECTION_BYTES) return { error: `Section "${section}" is too large (${body.length} bytes)`, status: 413 };
  try {
    if (cur) await put(pathOf(section), body, { ...OPTS, allowOverwrite: true, ...(cur.etag ? { ifMatch: cur.etag } : {}) });
    else await put(pathOf(section), body, { ...OPTS, allowOverwrite: false });
  } catch (err) {
    if (isPrecondition(err) || isExists(err)) {
      const now2 = await readSection(section);
      return { conflict: true, current: now2 ? { version: now2.version, updatedAt: now2.updatedAt, updatedBy: now2.updatedBy, data: now2.data } : null };
    }
    throw err;
  }
  return { ok: true, version: doc.version, updatedAt: now };
}

// Record counts per section — reported after a migration upload.
export function countOf(data) {
  if (Array.isArray(data)) return data.filter((r) => !r?.deleted).length;
  if (data && typeof data === 'object') return Object.keys(data).length;
  return 0;
}

// ─── Backups ─────────────────────────────────────────────────────────────────

export async function backupAll(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const saved = [];
  for (const s of SECTIONS) {
    const raw = await readRaw(pathOf(s));
    if (!raw) continue;
    await put(`${BACKUP_PREFIX}${day}/${s}.json`, raw.text, { ...OPTS, allowOverwrite: true });
    saved.push(s);
  }
  // Prune backup days older than BACKUP_DAYS.
  const cutoff = new Date(date.getTime() - BACKUP_DAYS * 864e5).toISOString().slice(0, 10);
  const stale = [];
  let cursor;
  do {
    const page = await list({ prefix: BACKUP_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const d = b.pathname.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) stale.push(b.url || b.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (stale.length) await del(stale);
  return { day, saved, pruned: stale.length };
}
