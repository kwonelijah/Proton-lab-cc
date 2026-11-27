#!/usr/bin/env node
// scripts/mac/proton-invoice-watch.mjs — uploads new invoice PDFs to the
// dashboard. Looks in ~/Desktop/Proton /Custom Orders/<Client>/Invoices/ for
// Invoice_NNNNN_*.pdf not sent yet; reads the number + total from the
// builder's sidecar <name>.json (or from the PDF text via pdftotext); POSTs
// it to /api/admin?action=invoice-upload, which attaches it to the matching
// deal (or lists it on Today as "Invoices to link").
// Run by launchd (com.protonlab.invoices, once a day at 21:35).
//   --baseline   mark every invoice already on disk as sent (install.sh does this once)
//   --dry-run    show what would be sent
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HOME, api, logger } from './lib.mjs';

const ROOT = process.env.PROTON_CUSTOM_ORDERS || path.join(HOME, 'Desktop', 'Proton ', 'Custom Orders');
const STATE = process.env.PROTON_INVOICE_STATE || path.join(HOME, 'Library', 'Application Support', 'ProtonLab', 'invoices-sent.json');
const PDFTOTEXT = ['/opt/homebrew/bin/pdftotext', '/usr/local/bin/pdftotext'].find((p) => fs.existsSync(p));
const NAME = /^Invoice_(\d{5})_.*\.pdf$/;
const log = logger('proton-invoices');
const args = new Set(process.argv.slice(2));

const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { sent: {} }; } };
const writeState = (s) => { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); };

function invoices() {
  const out = [];
  for (const client of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!client.isDirectory()) continue;
    const dir = path.join(ROOT, client.name, 'Invoices');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = NAME.exec(f);
      if (m && !/_v\d+\.pdf$/.test(f)) out.push({ client: client.name.trim(), file: path.join(dir, f), rel: path.join(client.name, 'Invoices', f), no: m[1] });
    }
  }
  return out;
}

function details(inv) {
  const side = inv.file.replace(/\.pdf$/, '.json');
  if (fs.existsSync(side)) {
    const s = JSON.parse(fs.readFileSync(side, 'utf8'));
    return { no: s.invoice_no || inv.no, total: s.total, date: s.date, client: s.client_folder || inv.client, billTo: s.bill_to || '' };
  }
  let total = null;
  if (PDFTOTEXT) {
    const text = execFileSync(PDFTOTEXT, ['-layout', inv.file, '-'], { encoding: 'utf8' });
    const m = /TOTAL\s*DUE[^\d£€]*[£€]?\s*([\d,]+\.\d{2})/i.exec(text) || /AMOUNT\s*DUE[^\d£€]*[£€]?\s*([\d,]+\.\d{2})/i.exec(text);
    if (m) total = Number(m[1].replace(/,/g, ''));
  }
  return { no: inv.no, total, date: new Date(fs.statSync(inv.file).mtime).toISOString().slice(0, 10), client: inv.client, billTo: '' };
}

async function main() {
  const state = readState();
  const all = invoices();
  if (args.has('--baseline')) {
    for (const inv of all) state.sent[inv.rel] ??= { no: inv.no, at: new Date().toISOString(), result: 'baseline' };
    writeState(state); log('baseline:', all.length, 'existing invoices marked as already sent'); return;
  }
  const todo = all.filter((inv) => !state.sent[inv.rel] && Date.now() - fs.statSync(inv.file).mtimeMs > 10_000);
  if (!todo.length) return;
  for (const inv of todo) {
    const info = details(inv);
    if (args.has('--dry-run')) { log('would send', inv.rel, JSON.stringify(info)); continue; }
    const res = await api('?action=invoice-upload', { method: 'POST',
      headers: { 'content-type': 'application/octet-stream', 'x-invoice': JSON.stringify(info) }, body: fs.readFileSync(inv.file) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.ok) { log('FAILED', inv.rel, `HTTP ${res.status}`, d.error || ''); continue; }   // retried next run
    state.sent[inv.rel] = { no: info.no, at: new Date().toISOString(), result: d.duplicate ? 'duplicate' : d.matched ? `deal ${d.club || d.order}` : 'to link' };
    writeState(state);
    log('sent', inv.rel, '→', state.sent[inv.rel].result);
  }
}

main().catch((err) => { log('FAILED', err.message); process.exitCode = 1; });
