// lib/dashboard-store.js
// Server-side state for the hosted order dashboard — everything that used to
// live only in one browser's localStorage — in ONE private Vercel Blob
// (same store + token as lib/bank-orders.js):
//
//   dashboard/state.json = {
//     rev,                                   // bumps on every write
//     sections: { <name>: {version, updatedAt, updatedBy, data} },
//     history:  [ {t, u, section, id, label, changes:[{f, from, to}]} ],   // hidden change log, capped
//     meta:     { usage:{month, reads, writes, lists}, storage:{bytes, at},
//                 lastSnapshot:{rev, at} }
//   }
//
// Why one blob: Vercel Hobby allows 10k reads / 2k writes a month and blocks
// Blob for 30 days past either — a pull is 1 read, a batched save 1 write.
//
// Writes are optimistic: each changed section carries the `baseVersion` the
// client last saw; a stale one answers {conflict, current} (the client
// merges and retries). A lost race on the blob ETag with no section overlap
// is retried here, so devices editing different sections never see a 409.
//
// Backups (all `put`s of the state text — 1 write each):
//   dashboard/backups/nightly/YYYY-MM-DD.json   (cron, 30 kept)
//   dashboard/backups/session/<ISO>.json        (end of an editing session, 20 kept)
//   dashboard/backups/restore/<ISO>.json        (taken before every restore, 10 kept)

import { put, get, list, del } from '@vercel/blob';

export const SECTIONS = ['orders', 'manual', 'planner', 'clubshops', 'retailcosts', 'analytics', 'stockAliases'];
export const RECORD_SECTIONS = ['orders', 'manual'];
export const STATE_PATH = 'dashboard/state.json';
export const LEGACY_PREFIX = 'dashboard/state/';            // v1 per-section blobs (migrated once)
export const BACKUP_PREFIX = 'dashboard/backups/';
export const KEEP = { nightly: 30, session: 20, restore: 10 };
export const SNAPSHOT_MIN_GAP_MS = 30 * 60 * 1000;
export const MAX_STATE_BYTES = 3.5 * 1024 * 1024;           // under Vercel's 4.5 MB body cap
export const HISTORY_MAX = 4000;
export const HISTORY_MAX_BYTES = 600 * 1024;
// Vercel Blob, Hobby plan (docs 2026-09-23). Over any of these → Blob blocked for 30 days.
// Storage is per account: the PUBLIC store proton-lab-cc-blob (site media,
// ~113 MB on 2026-11-26) shares the 1 GB, and this code can only list the
// private store — so its size is reserved here (BLOB_OTHER_STORES_BYTES).
const OTHER_STORES_BYTES = Number(process.env.BLOB_OTHER_STORES_BYTES || 120e6);
export const LIMITS = { storageBytes: 1e9 - OTHER_STORES_BYTES, reads: 10000, writes: 2000, transferBytes: 10e9 };

const OPTS = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };
export const isSection = (s) => SECTIONS.includes(s);

// ─── usage estimate ──────────────────────────────────────────────────────────
// Ops are counted per instance and folded into meta.usage on the next state
// write — free, but an estimate (reads on an instance that never writes are
// lost). The meter shows it as such.
const pending = { reads: 0, writes: 0, lists: 0 };
const monthOf = (d = new Date()) => d.toISOString().slice(0, 7);
function foldUsage(meta, now = new Date()) {
  const m = monthOf(now);
  if (!meta.usage || meta.usage.month !== m) meta.usage = { month: m, reads: 0, writes: 0, lists: 0 };
  meta.usage.reads += pending.reads; meta.usage.writes += pending.writes + 1; meta.usage.lists += pending.lists;
  pending.reads = pending.writes = pending.lists = 0;
}

async function readText(pathname) {
  pending.reads++;
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return { text: await new Response(r.stream).text(), etag: r.blob?.etag || null };
}
async function putText(pathname, text, extra = {}) {
  pending.writes++;
  return put(pathname, text, { ...OPTS, ...extra });
}
async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    pending.lists++;
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const emptyDoc = () => ({ rev: 0, sections: {}, history: [], meta: {} });

// The v1 layout (one blob per section) → one doc, written once.
async function migrateLegacy() {
  const doc = emptyDoc();
  let found = 0;
  for (const s of SECTIONS) {
    const raw = await readText(`${LEGACY_PREFIX}${s}.json`).catch(() => null);
    if (!raw) continue;
    const d = JSON.parse(raw.text);
    doc.sections[s] = { version: d.version || 1, updatedAt: d.updatedAt, updatedBy: d.updatedBy, data: d.data };
    found++;
  }
  if (!found) return null;
  doc.rev = 1;
  foldUsage(doc.meta);
  try { await putText(STATE_PATH, JSON.stringify(doc), { allowOverwrite: false }); } catch { /* another instance migrated first */ }
  return readState();
}

// → {doc, etag} (etag null when the state blob doesn't exist yet)
export async function readState() {
  const raw = await readText(STATE_PATH);
  if (!raw) return { doc: emptyDoc(), etag: null };
  const doc = JSON.parse(raw.text);
  doc.sections ||= {}; doc.history ||= []; doc.meta ||= {};
  return { doc, etag: raw.etag };
}

const publicSection = (x) => (x ? { version: x.version, updatedAt: x.updatedAt, updatedBy: x.updatedBy, data: x.data } : null);

// → { rev, sections: {name: {version, updatedAt, updatedBy, data} | null} }
export async function readAll() {
  let st = await readState();
  if (!st.etag) st = (await migrateLegacy()) || st;
  const sections = {};
  for (const s of SECTIONS) sections[s] = publicSection(st.doc.sections[s]);
  return { rev: st.doc.rev || 0, sections };
}

const isPrecondition = (err) => err?.name === 'BlobPreconditionFailedError' || /precondition/i.test(String(err?.message || ''));
const isExists = (err) => /already exists/i.test(String(err?.message || ''));

function capHistory(h) {
  if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
  while (h.length > 50 && JSON.stringify(h).length > HISTORY_MAX_BYTES) h.splice(0, Math.ceil(h.length / 10));
  return h;
}
function cleanHistory(entries, user, now) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 300).filter((e) => e && typeof e === 'object').map((e) => ({
    t: typeof e.t === 'string' ? e.t.slice(0, 30) : now,
    u: user,
    section: String(e.section || '').slice(0, 20),
    id: String(e.id ?? '').slice(0, 80),
    label: String(e.label ?? '').slice(0, 120),
    changes: Array.isArray(e.changes) ? e.changes.slice(0, 40).map((c) => ({
      f: String(c?.f ?? '').slice(0, 60), from: short(c?.from), to: short(c?.to),
    })) : [],
  }));
}
function short(v) {
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 119) + '…' : s;
}

// changes: [{section, baseVersion, data}]
// → {ok, rev, versions:{s:n}} | {conflict, current:{s: section|null}} | {error, status}
export async function saveSections(changes, { user = 'unknown', history = [], force = false } = {}) {
  if (!Array.isArray(changes) || !changes.length) return { error: 'No changes', status: 400 };
  for (const c of changes) {
    if (!isSection(c?.section)) return { error: `Unknown section "${String(c?.section).slice(0, 40)}"`, status: 400 };
    if (c.data === undefined) return { error: `Missing data for ${c.section}`, status: 400 };
  }
  const now = new Date().toISOString();
  const entries = cleanHistory(history, user, now);
  for (let attempt = 0; attempt < 4; attempt++) {
    let { doc, etag } = await readState();
    if (!etag) {
      const migrated = await migrateLegacy();
      if (migrated) ({ doc, etag } = migrated);
    }
    const stale = force ? [] : changes.filter((c) => Number(c.baseVersion || 0) !== (doc.sections[c.section]?.version || 0));
    if (stale.length) {
      const current = {};
      for (const c of changes) current[c.section] = publicSection(doc.sections[c.section]);
      return { conflict: true, current, stale: stale.map((c) => c.section) };
    }
    const versions = {};
    for (const c of changes) {
      const v = (doc.sections[c.section]?.version || 0) + 1;
      doc.sections[c.section] = { version: v, updatedAt: now, updatedBy: user, data: c.data };
      versions[c.section] = v;
    }
    doc.rev = (doc.rev || 0) + 1;
    if (entries.length) doc.history = capHistory(doc.history.concat(entries));
    foldUsage(doc.meta);
    const body = JSON.stringify(doc);
    if (body.length > MAX_STATE_BYTES) return { error: `Dashboard data is too large (${body.length} bytes)`, status: 413 };
    try {
      if (etag) await putText(STATE_PATH, body, { allowOverwrite: true, ifMatch: etag });
      else await putText(STATE_PATH, body, { allowOverwrite: false });
      return { ok: true, rev: doc.rev, versions, updatedAt: now, doc };
    } catch (err) {
      if (isPrecondition(err) || isExists(err)) continue;   // someone else wrote — re-read and re-check
      throw err;
    }
  }
  return { error: 'Too many concurrent saves — try again', status: 503 };
}

// Record counts per section — reported after an import / shown on backups.
export function countOf(data) {
  if (Array.isArray(data)) return data.filter((r) => !r?.deleted).length;
  if (data && typeof data === 'object') return Object.keys(data).length;
  return 0;
}
export function countsOf(doc) {
  const out = {};
  for (const s of SECTIONS) out[s] = doc?.sections?.[s] ? countOf(doc.sections[s].data) : 0;
  return out;
}

// ─── usage ───────────────────────────────────────────────────────────────────
export async function usage() {
  const { doc } = await readState();
  const u = doc.meta.usage && doc.meta.usage.month === monthOf() ? doc.meta.usage : { month: monthOf(), reads: 0, writes: 0, lists: 0 };
  // Reads/lists done since the last fold on this instance are added live.
  return {
    month: u.month,
    reads: u.reads + pending.reads,
    writes: u.writes + pending.writes,
    lists: u.lists + pending.lists,
    storage: doc.meta.storage || null,
    health: doc.meta.health || null,
    limits: LIMITS,
    estimate: true,
  };
}

// How close this month is to the Hobby limits (writes = advanced ops =
// puts + lists). level 90 / 70 / 0 drives the reminders (2026-11-27).
export function usageLevel(u) {
  const w = ((u.writes || 0) + (u.lists || 0)) / LIMITS.writes;
  const r = (u.reads || 0) / LIMITS.reads;
  const st = u.storage && u.storage.bytes ? u.storage.bytes / LIMITS.storageBytes : 0;
  const top = Math.max(w, r, st);
  return { pct: Math.round(top * 100), writes: Math.round(w * 100), reads: Math.round(r * 100), storage: Math.round(st * 100), level: top >= 0.9 ? 90 : top >= 0.7 ? 70 : 0 };
}

// Last nightly run: backup / stock sync ok or not (shown on Today + digest).
export async function recordHealth(patch) {
  return patchMeta((meta) => { meta.health = { ...(meta.health || {}), ...patch }; });
}

// True the first time `key` is seen (e.g. 'usage-70:2026-11'), so a reminder
// is pushed once per threshold per month.
export async function markAlerted(key) {
  let first = false;
  await patchMeta((meta) => {
    meta.alerted = meta.alerted || {};
    for (const k of Object.keys(meta.alerted)) if (!k.endsWith(new Date().toISOString().slice(0, 7))) delete meta.alerted[k];
    if (!meta.alerted[key]) { meta.alerted[key] = new Date().toISOString(); first = true; }
  });
  return first;
}

// Storage total (cron, weekly) — 1 list per 1000 blobs.
export async function measureStorage() {
  const blobs = await listAll('');
  const bytes = blobs.reduce((n, b) => n + (b.size || 0), 0);
  await patchMeta((meta) => { meta.storage = { bytes, count: blobs.length, at: new Date().toISOString() }; });
  return { bytes, count: blobs.length };
}

// Small meta-only update (ETag-safe, retried).
async function patchMeta(fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, etag } = await readState();
    if (!etag) return null;
    fn(doc.meta);
    foldUsage(doc.meta);
    try { await putText(STATE_PATH, JSON.stringify(doc), { allowOverwrite: true, ifMatch: etag }); return doc; }
    catch (err) { if (!isPrecondition(err)) throw err; }
  }
  return null;
}

// Running storage total, adjusted on every document upload / delete between
// the weekly measurements.
export async function bumpStorage(delta) {
  return patchMeta((meta) => {
    const cur = meta.storage || { bytes: 0, count: 0, at: null };
    meta.storage = { ...cur, bytes: Math.max(0, (cur.bytes || 0) + delta), count: Math.max(0, (cur.count || 0) + Math.sign(delta)) };
  });
}

// ─── backups / snapshots / restore ───────────────────────────────────────────

const stamp = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-');

// Nightly (cron): one put of the state text, then prune every kind.
export async function backupAll(date = new Date()) {
  const raw = await readText(STATE_PATH);
  const day = date.toISOString().slice(0, 10);
  if (raw) await putText(`${BACKUP_PREFIX}nightly/${day}.json`, raw.text, { allowOverwrite: true });
  const pruned = await pruneBackups();
  return { day, saved: !!raw, pruned };
}

export async function listBackups() {
  const blobs = await listAll(BACKUP_PREFIX);
  return blobs
    .map((b) => {
      const rest = b.pathname.slice(BACKUP_PREFIX.length);
      const kind = rest.split('/')[0];
      return KEEP[kind] ? { path: b.pathname, kind, at: (b.uploadedAt instanceof Date ? b.uploadedAt : new Date(b.uploadedAt || 0)).toISOString(), size: b.size || 0 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function pruneBackups() {
  const all = await listBackups();
  const stale = [];
  for (const kind of Object.keys(KEEP)) {
    const ofKind = all.filter((b) => b.kind === kind);   // newest first
    stale.push(...ofKind.slice(KEEP[kind]).map((b) => b.path));
  }
  if (stale.length) await del(stale);
  return stale.length;
}

// End of an editing session: only when the state moved since the last
// snapshot, and not more often than every 30 min (pre-restore always runs).
export async function snapshot({ reason = 'session', now = new Date() } = {}) {
  const raw = await readText(STATE_PATH);
  if (!raw) return { skipped: 'empty' };
  const doc = JSON.parse(raw.text);
  const last = doc.meta?.lastSnapshot;
  if (reason === 'session') {
    if (last && last.rev === doc.rev) return { skipped: 'unchanged' };
    if (last && now - new Date(last.at) < SNAPSHOT_MIN_GAP_MS) return { skipped: 'recent' };
  }
  const kind = reason === 'restore' ? 'restore' : 'session';
  const path = `${BACKUP_PREFIX}${kind}/${stamp(now)}.json`;
  await putText(path, raw.text, { allowOverwrite: true });
  if (kind === 'session') await patchMeta((meta) => { meta.lastSnapshot = { rev: doc.rev, at: now.toISOString() }; });
  return { ok: true, path, rev: doc.rev };
}

const isBackupPath = (p) => typeof p === 'string' && p.startsWith(BACKUP_PREFIX) && !p.includes('..') && p.endsWith('.json');

export async function readBackup(path) {
  if (!isBackupPath(path)) return null;
  const raw = await readText(path);
  if (!raw) return null;
  return JSON.parse(raw.text);
}

// Restore chosen sections (or all) from a backup. A "restore" snapshot of
// the current state is taken first, so a restore can itself be undone.
export async function restore(path, { sections = null, user = 'unknown' } = {}) {
  const backup = await readBackup(path);
  if (!backup) return { error: 'Backup not found', status: 404 };
  const want = (Array.isArray(sections) && sections.length ? sections : SECTIONS).filter(isSection);
  const pre = await snapshot({ reason: 'restore' });
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, etag } = await readState();
    const now = new Date().toISOString();
    const restored = [];
    for (const s of want) {
      const from = backup.sections?.[s];
      if (!from) continue;
      doc.sections[s] = { version: (doc.sections[s]?.version || 0) + 1, updatedAt: now, updatedBy: user, data: from.data };
      restored.push(s);
    }
    if (!restored.length) return { error: 'Nothing to restore from that backup', status: 400 };
    doc.rev = (doc.rev || 0) + 1;
    doc.history = capHistory((doc.history || []).concat([{ t: now, u: user, section: '*', id: '', label: `Restored from ${path.slice(BACKUP_PREFIX.length)}`, changes: restored.map((s) => ({ f: s, from: null, to: 'restored' })) }]));
    foldUsage(doc.meta);
    try {
      if (etag) await putText(STATE_PATH, JSON.stringify(doc), { allowOverwrite: true, ifMatch: etag });
      else await putText(STATE_PATH, JSON.stringify(doc), { allowOverwrite: false });
      return { ok: true, restored, preRestore: pre.path || null, rev: doc.rev };
    } catch (err) { if (!isPrecondition(err) && !isExists(err)) throw err; }
  }
  return { error: 'Too many concurrent saves — try again', status: 503 };
}

// Hidden change log — retrieval only (no UI yet).
export async function historyFor({ id = '', section = '', limit = 200 } = {}) {
  const { doc } = await readState();
  return doc.history
    .filter((e) => (!id || e.id === String(id)) && (!section || e.section === section))
    .slice(-Math.min(Math.max(1, +limit || 200), 1000))
    .reverse();
}

export { pending as _pendingOps };
