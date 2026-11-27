/* lib/today.cjs — "Today": what needs doing, as one pure function shared by
   the hosted dashboard (served at /today.js → window.PLToday) and the morning
   push digest in api/stock-sync.js (?job=morning). Same rules on both, so the
   notification and the screen never disagree.

   todayItems({ orders, feed, manual, clubs, windows }, now) →
     { sections:[{key, title, items:[{id, title, sub, severity, target}]}], counts, total, summary }

   orders   pipeline orders (state section "orders")
   feed     /api/admin JSON feed {awaiting, dispatched} — Stripe + bank orders (null if unavailable)
   manual   manual web-shop orders (state section "manual")
   clubs    [{handle, name, windowStart, windowEnd}] from clubs.ts (null if unavailable)
   windows  clubShopData.windows — {<handle|name:x>: [{id,label,start,end}]}
   unmatchedInvoices  [{no, total, client, at}] invoices uploaded from the Mac with no matching deal
   Dates are YYYY-MM-DD (UTC), like the dashboard's today(); shown as dd/mm/yyyy
   with no relative words (Elijah, 2026-11-27). */
(function (root) {
  'use strict';
  const RULES = { nextSoonDays: 2, windowClosingDays: 3, unpaidAfterDays: 5, stalledAfterDays: 14 };
  const STALL_EXEMPT = { delivered: 1, production: 1, delivery: 1 };   // waiting on the factory / post is not "stalled"
  const STAGE_NAME = { contact: 'Initial Contact', discuss: 'Discussion', design: 'Design', order: 'Order Window', production: 'Production (CN)', delivery: 'Delivery Processing', delivered: 'Delivered' };

  const ymd = (d) => new Date(d).toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  const fmt = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || ''); };
  const gbp = (n) => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function isClubOrder(o) {
    if (o.pipelineId) return false;
    if (o.clubHandle) return true;
    const c = String(o.club || '').trim();
    return !!c && c !== 'Proton Lab' && c !== 'N/A';
  }

  function todayItems(input, now) {
    input = input || {};
    const t = ymd(now || Date.now());
    const orders = Array.isArray(input.orders) ? input.orders : [];
    const feed = input.feed && Array.isArray(input.feed.awaiting) ? input.feed : null;
    const manual = Array.isArray(input.manual) ? input.manual : [];
    const sections = [];

    // 1. Next steps due / overdue
    const next = orders
      .filter((o) => o && o.stage !== 'delivered' && o.nextDate && o.nextDate <= addDays(t, RULES.nextSoonDays))
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .map((o) => {
        const d = daysBetween(t, o.nextDate);
        return { id: o.id, title: o.club || 'Untitled', sub: `${o.next || 'Next step'} · ${d < 0 ? 'overdue since' : 'due'} ${fmt(o.nextDate)}`,
          severity: d < 0 ? 'high' : d === 0 ? 'mid' : 'low', target: { type: 'pipeline', id: o.id } };
      });
    sections.push({ key: 'next', title: 'Next steps', items: next });

    // 2. Club windows closing soon (local windows, then clubs.ts dates not already covered)
    const closing = [];
    const seen = new Set();
    const nameOf = (key) => {
      const c = (input.clubs || []).find((x) => x.handle === key);
      return c ? c.name : String(key).replace(/^name:/, '');
    };
    const countFor = (handle, start, end) => {
      if (!feed) return null;
      return feed.awaiting.concat(feed.dispatched || []).filter((o) => o.clubHandle === handle && (!start || (o.date || '').slice(0, 10) >= start) && (!end || (o.date || '').slice(0, 10) <= end)).length;
    };
    const pushWindow = (handle, w) => {
      if (!w || !w.end) return;
      const d = daysBetween(t, w.end);
      if (d < 0 || d > RULES.windowClosingDays) return;
      const k = handle + '|' + w.end;
      if (seen.has(k)) return;
      seen.add(k);
      const n = countFor(handle, w.start, w.end);
      closing.push({ id: k, title: nameOf(handle), sub: `Order window closes ${fmt(w.end)}${n != null ? ` · ${plural(n, 'order')} so far` : ''}`,
        severity: d <= 1 ? 'mid' : 'low', target: { type: 'club', id: handle } });
    };
    const windows = input.windows && typeof input.windows === 'object' ? input.windows : {};
    for (const handle of Object.keys(windows)) for (const w of windows[handle] || []) pushWindow(handle, w);
    for (const c of input.clubs || []) if (c.windowEnd && !windows[c.handle]) pushWindow(c.handle, { start: c.windowStart, end: c.windowEnd });
    closing.sort((a, b) => a.id.split('|')[1].localeCompare(b.id.split('|')[1]));
    sections.push({ key: 'windows', title: 'Windows closing', items: closing });

    // 3. Money owed — custom-kit deals invoiced and not yet paid
    const owed = orders.filter((o) => o && !o.deleted && o.paidVia === 'invoice' && !o.invoicePaidDate && Number(o.invoiceAmount) > 0)
      .sort((a, b) => String(a.invoiceSentDate || a.updated || '').localeCompare(String(b.invoiceSentDate || b.updated || '')))
      .map((o) => {
        const sent = o.invoiceSentDate || '';
        const age = sent ? daysBetween(sent, t) : 0;
        return { id: 'owed:' + o.id, title: o.club || 'Untitled',
          sub: [gbp(o.invoiceAmount), o.invoiceNo ? `invoice ${o.invoiceNo}` : 'invoice', sent ? `sent ${fmt(sent)}` : ''].filter(Boolean).join(' · '),
          severity: age > 14 ? 'mid' : 'low', target: { type: 'pipeline', id: o.id } };
      });
    sections.push({ key: 'owed', title: 'Money owed', items: owed });

    // 4. Bank transfers — past the pay-by date (red), then still waiting > 5 days
    const transfers = feed ? feed.awaiting.filter((o) => o.payment === 'bank-transfer' && !o.paid).map((o) => {
      const placed = (o.date || '').slice(0, 10) || t;
      const payBy = (o.payBy || '').slice(0, 10);
      return { o, age: daysBetween(placed, t), placed, late: !!payBy && payBy < t, payBy };
    }) : [];
    const transferItem = ({ o, late, payBy, placed }) => ({
      id: o.id, title: `${o.ref || o.id} · ${o.name || ''}`.trim(),
      sub: `${gbp(o.amount)} · ${o.payRef || ''} · ${late ? `pay-by ${fmt(payBy)} passed` : `placed ${fmt(placed)}`}`,
      severity: late ? 'high' : 'mid', target: { type: 'order', id: o.id },
    });
    const late = transfers.filter((x) => x.late).map(transferItem);
    const waiting = transfers.filter((x) => !x.late && x.age > RULES.unpaidAfterDays).map(transferItem);
    sections.push({ key: 'unpaid', title: 'Overdue bank transfers', items: late });
    sections.push({ key: 'awaiting', title: 'Awaiting payment', items: waiting });

    // 4. Ready to dispatch — grouped: retail, then each club
    const ready = (feed ? feed.awaiting : []).filter((o) => !(o.payment === 'bank-transfer' && !o.paid))
      .concat(manual.filter((o) => o && !o.dispatchedAt));
    const groups = new Map();
    for (const o of ready) {
      const club = isClubOrder(o);
      const key = club ? (o.clubHandle || o.club) : '__retail';
      const g = groups.get(key) || { key, title: club ? (o.club || nameOf(o.clubHandle)) : 'Retail (web shop)', n: 0, oldest: null, first: o.id, club };
      g.n++;
      const d = (o.date || '').slice(0, 10);
      if (d && (!g.oldest || d < g.oldest)) g.oldest = d;
      groups.set(key, g);
    }
    const dispatch = [...groups.values()].sort((a, b) => (a.club - b.club) || b.n - a.n).map((g) => {
      const age = g.oldest ? daysBetween(g.oldest, t) : 0;
      return { id: 'dispatch:' + g.key, title: g.title, sub: `${plural(g.n, 'order')} to dispatch${g.oldest ? ` · oldest ${fmt(g.oldest)}` : ''}`,
        severity: !g.club && age >= 3 ? 'mid' : 'low', target: g.club ? { type: 'club', id: g.key } : { type: 'retail', id: g.first } };
    });
    sections.push({ key: 'dispatch', title: 'Ready to dispatch', items: dispatch });

    // 6. Refunds to receive back — refunded orders whose kit hasn't come back yet
    const returns = (feed && Array.isArray(feed.refunded) ? feed.refunded : []).filter((o) => !o.returnedAt).map((o) => ({
      id: 'return:' + o.id, title: `${o.ref || o.id} · ${o.name || ''}`.trim(),
      sub: `Refunded ${gbp(o.refundedAmount || o.amount)}${o.refundedAt ? ` on ${fmt(o.refundedAt.slice(0, 10))}` : ''} · awaiting return`,
      severity: 'low', target: { type: 'refund', id: o.id },
    }));
    sections.push({ key: 'returns', title: 'Refunds to receive back', items: returns });

    // 7. Invoices uploaded from the Mac that matched no deal
    const unmatched = (Array.isArray(input.unmatchedInvoices) ? input.unmatchedInvoices : []).map((v) => ({
      id: 'invoice:' + v.no, title: `Invoice ${v.no}${v.client ? ' · ' + v.client : ''}`,
      sub: `${v.total != null ? gbp(v.total) + ' · ' : ''}choose the deal`, severity: 'mid', target: { type: 'invoice', id: String(v.no) },
    }));
    sections.push({ key: 'invoices', title: 'Invoices to link', items: unmatched });

    // 5. Stalled deals
    const stalled = orders.filter((o) => o && !STALL_EXEMPT[o.stage] && o.updated && daysBetween(o.updated, t) > RULES.stalledAfterDays)
      .sort((a, b) => a.updated.localeCompare(b.updated))
      .map((o) => ({ id: o.id, title: o.club || 'Untitled', sub: `${STAGE_NAME[o.stage] || o.stage} · no change since ${fmt(o.updated)}`,
        severity: 'low', target: { type: 'pipeline', id: o.id } }));
    sections.push({ key: 'stalled', title: 'Stalled deals', items: stalled });

    const counts = {
      overdue: next.filter((x) => x.severity === 'high').length,
      due: next.length,
      windows: closing.length,
      owed: owed.length,
      unpaid: late.length,
      awaiting: waiting.length,
      dispatch: ready.length,
      returns: returns.length,
      invoices: unmatched.length,
      stalled: stalled.length,
    };
    const parts = [];
    if (counts.overdue) parts.push(`${counts.overdue} overdue`);
    if (counts.due - counts.overdue) parts.push(`${counts.due - counts.overdue} due soon`);
    if (counts.windows) parts.push(`${plural(counts.windows, 'window')} closing`);
    if (counts.owed) parts.push(`${counts.owed} owed`);
    if (counts.unpaid) parts.push(`${counts.unpaid} unpaid`);
    if (counts.dispatch) parts.push(`${counts.dispatch} to dispatch`);
    if (counts.returns) parts.push(`${plural(counts.returns, 'return')} due back`);
    if (counts.invoices) parts.push(`${plural(counts.invoices, 'invoice')} to link`);
    if (counts.stalled) parts.push(`${counts.stalled} stalled`);
    const total = sections.reduce((n, s) => n + s.items.length, 0);
    return { date: t, sections, counts, total, summary: parts.join(' · ') || 'All clear' };
  }

  const api = { todayItems, RULES, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PLToday = api;
})(typeof self !== 'undefined' ? self : this);
