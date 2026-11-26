// lib/docs.js
// Order documents uploaded from the hosted dashboard (PIs, order forms,
// invoices, mockups, phone photos) — private blobs at
//   docs/<orderId>/<random>-<safe filename>
// served only through api/admin.js ?action=doc (session-gated, streamed), so
// a blob URL is never handed to the browser.
//
// Upload goes through the function as the raw request body (Vercel caps a
// function body at 4.5 MB, so files are ≤ 4 MB; the dashboard shrinks phone
// photos to ~300 KB first). Hobby Blob storage is 1 GB in total and going over
// pauses ALL Blob use for 30 days (incl. bank-transfer checkout), so uploads
// are refused once the store reaches 90% (meta.storage, measured weekly +
// updated on every upload / delete).
//
// Delete = move to docs/_trash/<ISO>__<path>; the nightly cron purges trash
// older than TRASH_DAYS.

import crypto from 'node:crypto';
import { put, get, del, list } from '@vercel/blob';
import { _pendingOps as pending, LIMITS, bumpStorage, readState } from './dashboard-store.js';

export const DOC_PREFIX = 'docs/';
export const TRASH_PREFIX = 'docs/_trash/';
export const TRASH_DAYS = 30;
export const MAX_DOC_BYTES = 4 * 1024 * 1024;
export const STORAGE_REFUSE_AT = 0.9;
export const ALLOWED = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function safeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
  return (base.replace(/^\.+/, '').slice(0, 80) || 'file');
}
const safeId = (id) => String(id || '').replace(/[^\w-]/g, '').slice(0, 40) || 'misc';

export const isDocPath = (p) => typeof p === 'string' && p.startsWith(DOC_PREFIX) && !p.startsWith(TRASH_PREFIX)
  && !p.includes('..') && !p.includes('//') && /^[\w./ -]+$/.test(p);

// → {ok, path, size, type, name} | {error, status}
export async function uploadDoc({ orderId, name, type, body }) {
  if (!Buffer.isBuffer(body) || !body.length) return { error: 'Empty file', status: 400 };
  if (body.length > MAX_DOC_BYTES) return { error: `File is ${(body.length / 1e6).toFixed(1)} MB — the limit is 4 MB. Shrink or split it, or keep it as a link.`, status: 413 };
  const ext = ALLOWED[type];
  if (!ext) return { error: 'That file type isn’t allowed (PDF, Excel, CSV, Word, PNG, JPG, WebP)', status: 415 };
  const { doc } = await readState();
  const used = doc.meta?.storage?.bytes || 0;
  if (used + body.length > LIMITS.storageBytes * STORAGE_REFUSE_AT) {
    return { error: 'Document storage is nearly full (90% of the 1 GB Hobby allowance) — delete old uploads or move to Vercel Pro.', status: 507 };
  }
  let file = safeName(name);
  if (!file.toLowerCase().endsWith('.' + ext) && !(ext === 'jpg' && /\.jpe?g$/i.test(file))) file = `${file.replace(/\.[^.]*$/, '')}.${ext}`;
  const path = `${DOC_PREFIX}${safeId(orderId)}/${crypto.randomBytes(5).toString('hex')}-${file}`;
  pending.writes++;
  await put(path, body, { access: 'private', contentType: type, addRandomSuffix: false, allowOverwrite: false });
  await bumpStorage(body.length).catch(() => {});
  return { ok: true, path, size: body.length, type, name: file };
}

// → {stream, type, size, name} | null
export async function openDoc(path) {
  if (!isDocPath(path)) return null;
  pending.reads++;
  const r = await get(path, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return { stream: r.stream, type: r.blob?.contentType || 'application/octet-stream', size: r.blob?.size, name: path.split('/').pop().replace(/^[0-9a-f]{10}-/, '') };
}

export async function trashDoc(path, now = new Date()) {
  if (!isDocPath(path)) return { error: 'Not a document', status: 400 };
  pending.reads++;
  const r = await get(path, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { ok: true, missing: true };
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  const to = `${TRASH_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}__${path.slice(DOC_PREFIX.length).replace(/\//g, '__')}`;
  pending.writes++;
  await put(to, buf, { access: 'private', contentType: r.blob?.contentType || 'application/octet-stream', addRandomSuffix: false, allowOverwrite: true });
  pending.writes++;
  await del(path);
  return { ok: true, trashed: to };
}

// Nightly: delete trash older than TRASH_DAYS → bytes freed.
export async function purgeTrash(now = new Date()) {
  const cutoff = now.getTime() - TRASH_DAYS * 864e5;
  const stale = []; let freed = 0; let cursor;
  do {
    pending.lists++;
    const page = await list({ prefix: TRASH_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const at = new Date(b.uploadedAt || 0).getTime();
      if (at < cutoff) { stale.push(b.pathname); freed += b.size || 0; }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (stale.length) { pending.writes++; await del(stale); await bumpStorage(-freed).catch(() => {}); }
  return { purged: stale.length, freed };
}
