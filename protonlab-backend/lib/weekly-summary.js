// lib/weekly-summary.js
// Monday-morning business summary to info@protonlab.cc (WEEKLY_SUMMARY_EMAIL
// overrides), sent by api/stock-sync.js ?job=morning on Mondays — the same
// run and the same gathered data as the Today push digest.
//
// Revenue here is ORDERS PLACED (Stripe + bank transfer, gross, before
// refunds / fees), last Monday–Sunday against the week before; the
// dashboard's Analytics tab stays the source for net, refund-adjusted figures.
//
// buildWeeklySummary(data, now) → {subject, html, text}   (pure, tested)
// sendWeeklySummary({...data, now, dryRun}) → {sent, to, subject, html?, error?}  (never throws)

import { Resend } from 'resend';
import { COLORS, FONTS, eyebrowStyle, bodyStyle, subduedStyle, heading, detailTable, button, divider, layout } from '../emails/theme.js';
import { readStock } from './stock.js';

const FROM = 'Proton Lab CC <noreply@protonlab.cc>';
const STAGES = [['contact', 'Initial Contact'], ['discuss', 'Discussion'], ['design', 'Design'], ['order', 'Order Window'], ['production', 'Production (CN)'], ['delivery', 'Delivery Processing']];
export const LOW_STOCK = 2;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const gbp = (n) => `£${(Math.round(n * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Last completed Monday–Sunday (UTC) and the one before it.
export function weeks(now = new Date()) {
  const t = ymd(now);
  const dow = (new Date(t + 'T00:00:00Z').getUTCDay() + 6) % 7;   // Mon = 0
  const thisMon = addDays(t, -dow);
  const last = { from: addDays(thisMon, -7), to: addDays(thisMon, -1) };
  const prev = { from: addDays(thisMon, -14), to: addDays(thisMon, -8) };
  return { last, prev };
}

const isClub = (o) => !o.pipelineId && (!!o.clubHandle || (!!o.club && o.club !== 'Proton Lab' && o.club !== 'N/A'));
function revenue(orders, w) {
  const r = { gbp: 0, eur: 0, orders: 0, retail: 0, club: 0, bank: 0 };
  for (const o of orders) {
    const d = String(o.date || '').slice(0, 10);
    if (!d || d < w.from || d > w.to) continue;
    const amt = Number(o.amount) || 0;
    r.orders++;
    if (o.symbol === '€') { r.eur += amt; continue; }
    r.gbp += amt;
    if (isClub(o)) r.club += amt; else r.retail += amt;
    if (o.payment === 'bank-transfer') r.bank += amt;
  }
  return r;
}
const delta = (a, b) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}% vs week before` : a ? 'first sales vs an empty week' : 'no sales either week');

export function buildWeeklySummary({ state, feed, clubs, today, stock }, now = new Date()) {
  const { last, prev } = weeks(now);
  const feedOrders = feed ? (feed.awaiting || []).concat(feed.dispatched || []) : [];
  const rl = revenue(feedOrders, last), rp = revenue(feedOrders, prev);
  const pipeline = (state?.sections?.orders?.data || []).filter((o) => o && !o.deleted);
  const open = pipeline.filter((o) => o.stage !== 'delivered');
  const openValue = open.reduce((n, o) => n + (Number(o.value) || 0), 0);
  const completed = pipeline.filter((o) => o.stage === 'delivered' && o.deliveredDate >= last.from && o.deliveredDate <= last.to);
  const t = ymd(now);
  const windowsOpen = (clubs || []).filter((c) => c.windowStart && c.windowEnd && c.windowStart <= t && t <= c.windowEnd)
    .map((c) => ({ name: c.name, end: c.windowEnd, n: feedOrders.filter((o) => o.clubHandle === c.handle && String(o.date || '').slice(0, 10) >= c.windowStart).length }));
  const unpaid = (feed?.awaiting || []).filter((o) => o.payment === 'bank-transfer' && !o.paid);
  const unpaidTotal = unpaid.reduce((n, o) => n + (Number(o.amount) || 0), 0);
  const low = (stock || []).filter((r) => Number(r.quantity) <= LOW_STOCK).sort((a, b) => a.quantity - b.quantity);

  const range = `${fmtDay(last.from)} – ${fmtDay(last.to)}`;
  const subject = `Proton weekly — ${gbp(rl.gbp)} from ${rl.orders} order${rl.orders === 1 ? '' : 's'} (${range})`;

  const sectionTitle = (s) => `<p style="${eyebrowStyle}margin:0 0 10px 0;">${esc(s)}</p>`;
  const para = (s, style = bodyStyle) => `<p style="${style}margin:0 0 24px 0;">${s}</p>`;
  const list = (items) => items.length
    ? `<ul style="${bodyStyle}margin:0 0 28px 0;padding-left:18px;">${items.map((i) => `<li style="margin:0 0 6px 0;">${i}</li>`).join('')}</ul>`
    : para('None.', subduedStyle);

  const todayItems = today ? today.sections.flatMap((s) => s.items.map((i) => `<b>${esc(i.title)}</b> — ${esc(i.sub)}`)) : [];
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://protonlab-backend.vercel.app/dashboard';

  const html = layout(`
    ${heading(`Week of ${esc(range)}`)}
    ${feed ? '' : para('⚠ The order feed could not be read this morning — revenue below is incomplete.', subduedStyle)}
    ${sectionTitle('Sales — orders placed (before refunds)')}
    ${detailTable([
      { label: 'Revenue', value: `${gbp(rl.gbp)}${rl.eur ? ` + €${rl.eur.toFixed(2)}` : ''} <span style="color:${COLORS.grey};">· ${esc(delta(rl.gbp, rp.gbp))}</span>`, bold: true },
      { label: 'Orders', value: `${rl.orders} <span style="color:${COLORS.grey};">(week before: ${rp.orders})</span>` },
      { label: 'Retail · Club shops', value: `${gbp(rl.retail)} · ${gbp(rl.club)}` },
      rl.bank ? { label: 'Of which bank transfer', value: gbp(rl.bank) } : null,
    ])}
    ${sectionTitle('Needs attention today')}
    ${para(esc(today ? today.summary : 'Unavailable'), bodyStyle + 'font-weight:bold;')}
    ${list(todayItems.slice(0, 8))}
    ${divider()}
    ${sectionTitle('Pipeline')}
    ${detailTable(STAGES.map(([k, name]) => {
      const n = open.filter((o) => o.stage === k);
      return n.length ? { label: name, value: `${n.length} · ${gbp(n.reduce((s, o) => s + (Number(o.value) || 0), 0))}` } : null;
    }).concat([
      { label: 'Open value', value: gbp(openValue), bold: true },
      { label: 'Completed last week', value: completed.length ? `${completed.length} · ${completed.map((o) => esc(o.club)).join(', ')}` : '0' },
    ]))}
    ${sectionTitle('Club shops open now')}
    ${list(windowsOpen.map((w) => `<b>${esc(w.name)}</b> — closes ${esc(fmtDay(w.end))} · ${w.n} order${w.n === 1 ? '' : 's'} so far`))}
    ${sectionTitle('Unpaid bank transfers')}
    ${unpaid.length ? para(`${unpaid.length} order${unpaid.length === 1 ? '' : 's'} · ${gbp(unpaidTotal)} outstanding`) : para('None.', subduedStyle)}
    ${sectionTitle(`Low stock (≤ ${LOW_STOCK})`)}
    ${stock ? list(low.slice(0, 12).map((r) => `${esc(r.handle)} <b>${esc(r.size)}</b>: ${Number(r.quantity)}`)) : para('Stock file unavailable this morning.', subduedStyle)}
    ${button('Open the dashboard', dashboardUrl)}
    <p style="font-family:${FONTS.body};font-size:11px;color:${COLORS.grey};margin:0;">Sent every Monday at 7am UTC. Revenue is orders placed (Stripe + bank transfer), gross — see Analytics for net and refunds.</p>
  `);

  const text = [
    `Proton weekly — ${range}`,
    `Revenue ${gbp(rl.gbp)}${rl.eur ? ` + €${rl.eur.toFixed(2)}` : ''} from ${rl.orders} orders (${delta(rl.gbp, rp.gbp)}); retail ${gbp(rl.retail)}, club ${gbp(rl.club)}`,
    `Today: ${today ? today.summary : 'unavailable'}`,
    ...todayItems.slice(0, 8).map((s) => `- ${s.replace(/<[^>]+>/g, '')}`),
    `Pipeline: ${open.length} open deals, ${gbp(openValue)}; completed last week: ${completed.length}`,
    `Club shops open: ${windowsOpen.map((w) => `${w.name} (closes ${w.end}, ${w.n} orders)`).join('; ') || 'none'}`,
    `Unpaid bank transfers: ${unpaid.length} (${gbp(unpaidTotal)})`,
    `Low stock: ${low.slice(0, 12).map((r) => `${r.handle} ${r.size}: ${r.quantity}`).join(', ') || 'none'}`,
    dashboardUrl,
  ].join('\n');

  return { subject, html, text };
}

export async function sendWeeklySummary({ state, feed, clubs, today, now = new Date(), dryRun = false, sendImpl = null }) {
  const to = process.env.WEEKLY_SUMMARY_EMAIL || 'info@protonlab.cc';
  let stock = null;
  try { stock = (await readStock()).rows; } catch (err) { console.error('weekly: stock read failed', err?.message); }
  const msg = buildWeeklySummary({ state, feed, clubs, today, stock }, now);
  if (dryRun) return { sent: false, dryRun: true, to, ...msg };
  try {
    let send = sendImpl;
    if (!send) {
      const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
      if (!key) return { sent: false, to, subject: msg.subject, error: 'RESEND_KEY_MISSING' };
      const resend = new Resend(key);
      send = (m) => resend.emails.send(m);
    }
    const r = await send({ from: FROM, to, subject: msg.subject, html: msg.html, text: msg.text });
    if (r?.error) return { sent: false, to, subject: msg.subject, error: String(r.error.message || r.error) };
    return { sent: true, to, subject: msg.subject };
  } catch (err) {
    console.error('weekly summary send failed', err?.message);
    return { sent: false, to, subject: msg.subject, error: String(err?.message || err).slice(0, 200) };
  }
}
