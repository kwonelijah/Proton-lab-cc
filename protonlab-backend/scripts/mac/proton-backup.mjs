#!/usr/bin/env node
// scripts/mac/proton-backup.mjs — nightly off-site copy of the dashboard.
// Downloads the newest nightly backup (made by the 20:00 UTC cron) to
//   ~/Desktop/Proton /Backups/Dashboard/dashboard-YYYY-MM-DD.json
// and keeps the newest 30. Run by launchd (com.protonlab.backup, 21:30 daily);
// safe to run by hand: `node scripts/mac/proton-backup.mjs`.
// The file holds customer names and addresses — it never leaves this Mac.
import fs from 'node:fs';
import path from 'node:path';
import { HOME, api, logger } from './lib.mjs';

const DEST = process.env.PROTON_BACKUP_DIR || path.join(HOME, 'Desktop', 'Proton ', 'Backups', 'Dashboard');
const KEEP = 30;
const log = logger('proton-backup');

async function main() {
  const r = await api('?action=backups');
  if (!r.ok) throw new Error(`list backups: HTTP ${r.status} ${await r.text()}`);
  const { backups = [] } = await r.json();
  const pick = backups.find((b) => b.kind === 'nightly') || backups[0];
  if (!pick) { log('no backups on the server yet'); return; }
  const day = String(pick.at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  fs.mkdirSync(DEST, { recursive: true });
  const file = path.join(DEST, `dashboard-${day}.json`);
  if (fs.existsSync(file)) { log('already have', path.basename(file)); }
  else {
    const d = await api(`?action=backup&download=1&path=${encodeURIComponent(pick.path)}`);
    if (!d.ok) throw new Error(`download ${pick.path}: HTTP ${d.status}`);
    const text = await d.text();
    const doc = JSON.parse(text);                          // refuse to save anything that isn't a state file
    if (!doc || typeof doc.sections !== 'object') throw new Error('download was not a dashboard backup');
    fs.writeFileSync(file + '.part', text);
    fs.renameSync(file + '.part', file);
    log('saved', path.basename(file), `${(text.length / 1024).toFixed(0)} KB`, `from ${pick.path}`);
  }
  const all = fs.readdirSync(DEST).filter((f) => /^dashboard-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) { fs.unlinkSync(path.join(DEST, old)); log('pruned', old); }
}

main().catch((err) => { log('FAILED', err.message); process.exitCode = 1; });
