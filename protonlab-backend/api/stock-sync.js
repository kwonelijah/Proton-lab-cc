// api/stock-sync.js
// Nightly stock sync: tallies the day's paid web-shop orders from Stripe and
// commits the decremented inventory/stock.csv to GitHub (one commit → the
// site redeploys with fresh stock). Scheduled by vercel.json crons; can also
// be run by hand with the admin key.
//
//   GET /api/stock-sync                 — Vercel cron (Authorization: Bearer CRON_SECRET)
//   GET /api/stock-sync?key=<admin key> — manual run
//   GET /api/stock-sync?key=...&dryRun=1&days=14 — report only, commit nothing
//
// Idempotency: processed PaymentIntents are stamped metadata.stock_synced and
// skipped forever after. The lookback window is 7 days (Hobby crons can be
// delayed or skipped; the stamps make the wide window free). Ordering is
// commit-first-then-stamp: a crash in between double-counts on the next run —
// stock reads too LOW (a lost sale at worst), never too high (an oversell).
//
// Refunds are not re-incremented automatically — use the dashboard Stock
// tab's "Stock in" adjustment.

import Stripe from 'stripe';
import { Resend } from 'resend';
import { applyAndCommit } from '../lib/stock.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization === `Bearer ${secret}`) return true;
  const key = process.env.proton_export_key;
  return Boolean(key && req.query.key === key);
}

function parseItems(meta) {
  // metadata.items is a JSON string capped at 500 chars by Stripe — treat
  // anything unparseable as a reported skip, never a crash.
  try {
    const items = JSON.parse(meta?.items || '');
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

async function sendSummary({ to, subject, lines }) {
  const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
  if (!key) return;
  try {
    await new Resend(key).emails.send({
      from: 'Proton Lab CC <noreply@protonlab.cc>',
      to,
      subject,
      text: lines.join('\n'),
    });
  } catch (err) {
    console.error('Stock-sync summary email failed:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorized(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const dryRun = req.query.dryRun === '1';
  const days = Math.min(/^\d+$/.test(req.query.days || '') ? Number(req.query.days) : DEFAULT_DAYS, MAX_DAYS);
  const sinceTs = Math.floor(Date.now() / 1000) - days * 86400;

  let payments;
  try {
    payments = await stripe.paymentIntents
      .list({ created: { gte: sinceTs }, limit: 100 })
      .autoPagingToArray({ limit: 1000 });
  } catch (err) {
    console.error('Stripe list error:', err);
    return res.status(502).json({ error: 'Failed to read orders from Stripe' });
  }

  const eligible = [];
  const parseFailures = [];
  for (const p of payments) {
    if (p.status !== 'succeeded') continue;
    if (p.metadata?.stock_synced) continue;
    if (!p.metadata?.items) continue; // pre-metadata era or non-shop payment
    const items = parseItems(p.metadata);
    if (!items) {
      parseFailures.push(p.id);
      continue;
    }
    eligible.push({ id: p.id, items });
  }

  const movements = eligible.flatMap((o) =>
    o.items.map((i) => ({ handle: i.handle, size: i.size, qty: -Math.abs(Number(i.qty) || 0) }))
  );

  if (!movements.length) {
    return res.status(200).json({
      ok: true, dryRun, days,
      scanned: payments.length, orders: 0,
      message: 'nothing to sync',
      parseFailures,
    });
  }

  const piIds = eligible.map((o) => o.id);
  const idList = piIds.length > 20 ? `${piIds.slice(0, 20).join(' ')} +${piIds.length - 20} more` : piIds.join(' ');
  const units = movements.reduce((s, m) => s + Math.abs(m.qty), 0);
  const message = `stock: nightly sync — ${units} units across ${eligible.length} orders\n\n${idList}`;

  if (dryRun) {
    return res.status(200).json({
      ok: true, dryRun: true, days,
      scanned: payments.length, orders: eligible.length, units,
      movements, parseFailures,
    });
  }

  let result;
  try {
    result = await applyAndCommit(movements, message);
  } catch (err) {
    console.error('Stock sync commit failed:', err);
    return res.status(502).json({ error: `Stock commit failed: ${err.message}` });
  }

  // Commit landed — stamp each PI (with one retry) so it is never re-counted.
  const sha7 = (result.commitSha || 'nocommit').slice(0, 7);
  const stamp = `${new Date().toISOString()}:${sha7}`;
  const stampFailures = [];
  for (const id of piIds) {
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        await stripe.paymentIntents.update(id, { metadata: { stock_synced: stamp } });
        ok = true;
      } catch (err) {
        if (attempt) {
          console.error('Failed to stamp stock_synced on', id, err.message);
          stampFailures.push(id);
        }
      }
    }
  }

  const summaryTo = process.env.STOCK_SYNC_EMAIL;
  if (summaryTo) {
    const lines = [
      `Nightly stock sync — ${new Date().toISOString().slice(0, 10)}`,
      '',
      `Orders processed: ${eligible.length} (${units} units), commit ${sha7}`,
      ...result.applied.map((a) => `  ${a.handle} ${a.size}: ${a.before} → ${a.after} (${a.delta})`),
      ...(result.skipped.length
        ? ['', 'Skipped (no stock row — expected for club kit):',
           ...result.skipped.map((s) => `  ${s.movement.handle || '?'} ${s.movement.size || '?'} (${s.reason})`)]
        : []),
      ...(result.clamped.length
        ? ['', 'CLAMPED AT 0 (sold more than recorded stock — check counts!):',
           ...result.clamped.map((c) => `  ${c.handle} ${c.size}: had ${c.before}, sale wanted ${-c.requested}`)]
        : []),
      ...(stampFailures.length
        ? ['', `STAMP FAILURES — these PIs may double-count next run (harmless, stock reads low) or can be stamped by hand in Stripe: ${stampFailures.join(', ')}`]
        : []),
      ...(parseFailures.length ? ['', `Unparseable items metadata (never synced): ${parseFailures.join(', ')}`] : []),
    ];
    await sendSummary({ to: summaryTo, subject: `Stock sync: ${units} units, ${eligible.length} orders`, lines });
  }

  return res.status(200).json({
    ok: true, dryRun: false, days,
    scanned: payments.length, orders: eligible.length, units,
    applied: result.applied, skipped: result.skipped, clamped: result.clamped,
    commitSha: result.commitSha, stampFailures, parseFailures,
  });
}
