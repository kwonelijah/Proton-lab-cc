/* dashboard/analytics.js — the Analytics tab (AnalyticsCore + data sync + 15
   charts), loaded only when Analytics opens (2026-11-27): it was ~140 KB of
   every page load. A classic script, so it shares the app's globals (orders,
   ws, anInputs…). The inputs store (AN_KEY, anNormalizeInputs, anInputs,
   anSaveInputs) stays in index.html because Backup / Import use it. */

/* ANALYTICS-CORE-BEGIN (generated from protonlab-backend/lib/analytics-core.cjs — edit there, then run scripts/inline-analytics-core.mjs) */
/* lib/analytics-core.cjs — the ONE source of truth for the analytics maths.
   Pure functions over the unified order-row shape that api/analytics.js builds
   from Stripe and that the dashboard builds for manual (bank-transfer) and
   wholesale orders. Nothing here touches Stripe, the DOM or the network.

   This file is ALSO inlined into ~/Desktop/Proton Dashboard/order-dashboard.html
   by scripts/inline-analytics-core.mjs (between the ANALYTICS-CORE markers),
   so it must stay a classic script: one IIFE, no require/process/Buffer, no
   named exports, no top-level helpers outside the IIFE, no closing script tag.
   Node side: `import core from './analytics-core.cjs'` (default import only).

   Money: every *Gbp field is pounds (not pence) in GBP as settled by Stripe
   (balance_transaction amount/fee/net, exchange_rate applied). See ANALYTICS.md
   for each metric's definition. */
const AnalyticsCore = (() => {
  const VAT_THRESHOLD = 90000;          // UK VAT registration threshold (£, rolling 12 months)
  const VAT_AMBER = 75000, VAT_RED = 85000;
  const META_SOURCES = ['facebook', 'instagram', 'ig', 'fb', 'meta'];
  const CHANNELS = ['retail', 'club', 'wholesale', 'unattributed'];
  const CHANNEL_LABEL = { retail: 'Retail', club: 'Club shop', wholesale: 'Wholesale', unattributed: 'Unattributed' };
  /* Retail colourways are separate products in the catalogue — this is the
     product → colourway grouping for the SKU drill-down (B9). Anything not
     listed is its own product with no colourway. */
  const SKU_GROUPS = {
    'sunset-jersey': ['Summer Jersey', 'Sunset'],
    'red-sky-jersey': ['Summer Jersey', 'Red Sky'],
    'ocean-blue-jersey': ['Summer Jersey', 'Ocean Blue'],
    'black-bib-shorts': ['Summer Bib Shorts', 'Black'],
    'granite-bib-shorts': ['Summer Bib Shorts', 'Granite'],
    'white-bib-shorts': ['Summer Bib Shorts', 'White'],
  };

  // ── small helpers ─────────────────────────────────────────────────────────
  const num = (v) => { const n = +v; return Number.isFinite(n) ? n : 0; };
  const round2 = (n) => Math.round(num(n) * 100) / 100;
  const sum = (list, f) => list.reduce((s, x) => s + num(f ? f(x) : x), 0);
  function fmtGBP(n) {
    const v = num(n);
    const s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '−£' : '£') + s;
  }
  function fmtPct(n) { return n == null || n === '' || !Number.isFinite(+n) ? '—' : (+n).toFixed(1) + '%'; }
  function titleCase(s) { return String(s || '').split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' '); }
  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function normPhone(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function customerKey(r) { return normEmail(r.email) || (normPhone(r.phone) ? 'tel:' + normPhone(r.phone) : ''); }

  // ── dates (UTC, ISO strings) ──────────────────────────────────────────────
  const dayKey = (iso) => String(iso || '').slice(0, 10);
  const dateOf = (key) => new Date(key + 'T00:00:00Z');
  const keyOf = (d) => d.toISOString().slice(0, 10);
  function addDays(key, n) { const d = dateOf(key); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); }
  function mondayOf(key) { const d = dateOf(key); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return keyOf(d); }
  function monthStart(key) { return key.slice(0, 7) + '-01'; }
  function monthEnd(key) { const [y, m] = key.slice(0, 7).split('-').map(Number); return keyOf(new Date(Date.UTC(y, m, 0))); }
  function daysBetween(a, b) { return Math.round((dateOf(b) - dateOf(a)) / 86400000); }
  function bucketKey(iso, grain) {
    const k = dayKey(iso); if (!k) return '';
    if (grain === 'month') return k.slice(0, 7);
    if (grain === 'week') return mondayOf(k);
    return k;
  }
  function bucketEnd(key, grain) {
    if (grain === 'month') return monthEnd(key + '-01');
    if (grain === 'week') return addDays(key, 6);
    return key;
  }
  function bucketsBetween(from, to, grain) {
    const out = [];
    if (!from || !to || from > to) return out;
    if (grain === 'month') {
      let [y, m] = from.slice(0, 7).split('-').map(Number);
      const end = to.slice(0, 7);
      for (let i = 0; i < 600; i++) {
        const k = `${y}-${String(m).padStart(2, '0')}`;
        out.push(k); if (k >= end) break;
        m++; if (m > 12) { m = 1; y++; }
      }
      return out;
    }
    let k = grain === 'week' ? mondayOf(from) : from;
    const step = grain === 'week' ? 7 : 1;
    while (k <= to && out.length < 5000) { out.push(k); k = addDays(k, step); }
    return out;
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function bucketLabel(key, grain) {
    if (grain === 'month') { const [y, m] = key.split('-'); return `${MONTHS[+m - 1]} ${y.slice(2)}`; }
    const [y, m, d] = key.split('-');
    return (grain === 'week' ? 'w/c ' : '') + `${+d} ${MONTHS[+m - 1]}`;
  }
  const rowDate = (r) => dayKey(r.paidAt || r.created);
  function inRange(key, from, to) { if (!key) return false; if (from && key < from) return false; if (to && key > to) return false; return true; }

  // ── classification ────────────────────────────────────────────────────────
  const channelOfRow = (r) => (CHANNELS.includes(r.channel) ? r.channel : 'unattributed');
  /* Mirror of the webhook rule (api/webhook.js) + the new `channel` metadata. */
  function channelOfMeta(meta) {
    meta = meta || {};
    if (meta.channel === 'retail' || meta.channel === 'club') return meta.channel;
    if (String(meta.club_handle || '').trim()) return 'club';
    const club = String(meta.club || '').trim();
    if (club && club.toLowerCase() !== 'proton lab') return 'club';
    if (club || meta.items || meta.product) return 'retail';
    return 'unattributed';   // pre-metadata era / non-shop payment
  }
  function attributionOfMeta(meta) {
    meta = meta || {};
    return {
      source: String(meta.utm_source || '').trim().toLowerCase(),
      medium: String(meta.utm_medium || '').trim().toLowerCase(),
      campaign: String(meta.utm_campaign || '').trim(),
      referrer: String(meta.referrer || '').trim(),
      attributed: meta.attributed === '1',
      fbc: !!meta.fbc,
    };
  }
  function attributionBucket(r) {
    const u = r.utm || {};
    if (u.source) return u.source;
    if (u.attributed) return 'direct';
    if (u.fbc) return 'meta-click';
    return 'unattributed';
  }
  const ATTR_LABEL = { direct: 'Direct', unattributed: 'Unattributed', 'meta-click': 'Meta click (proxy)' };
  const attrLabel = (b) => ATTR_LABEL[b] || b;
  const isMetaSource = (b) => META_SOURCES.includes(b);
  function postcodeArea(postal, country) {
    if (String(country || 'GB').toUpperCase() !== 'GB') return '';
    const m = String(postal || '').trim().toUpperCase().match(/^([A-Z]{1,2})\d/);
    return m ? m[1] : '';
  }
  function regionCountry(region) { return region === 'uk' ? 'GB' : region === 'ireland' ? 'IE' : ''; }
  function skuMeta(handle, name) {
    const g = SKU_GROUPS[handle];
    if (g) return { product: g[0], colourway: g[1] };
    return { product: name || titleCase(handle), colourway: '—' };
  }

  // ── filtering ─────────────────────────────────────────────────────────────
  function filterRows(rows, opts) {
    opts = opts || {};
    return (rows || []).filter((r) => {
      if (!inRange(rowDate(r), opts.from, opts.to)) return false;
      if (opts.channel && opts.channel !== 'all' && channelOfRow(r) !== opts.channel) return false;
      return true;
    });
  }
  function rowsByChannel(rows, channel) {
    return (!channel || channel === 'all') ? rows : rows.filter((r) => channelOfRow(r) === channel);
  }
  const rowById = (rows) => new Map((rows || []).map((r) => [r.id, r]));
  const okRefund = (f) => !f.status || f.status === 'succeeded' || f.status === 'pending';
  /* Refunds that belong to the selected channel (via their order) and happened in [from,to]. */
  function refundsIn(ctx, opts) {
    opts = opts || {};
    const byId = rowById(ctx.rows);
    return (ctx.refunds || []).filter((f) => {
      if (!okRefund(f)) return false;
      if (!inRange(dayKey(f.created), opts.from, opts.to)) return false;
      if (opts.channel && opts.channel !== 'all') {
        const r = byId.get(f.paymentIntent);
        if (channelOfRow(r || {}) !== opts.channel) return false;
      }
      return true;
    });
  }
  const seriesBase = (opts) => {
    const keys = bucketsBetween(opts.from, opts.to, opts.grain || 'day');
    const idx = new Map(keys.map((k, i) => [k, i]));
    return { keys, labels: keys.map((k) => bucketLabel(k, opts.grain || 'day')), idx, zeros: () => keys.map(() => 0) };
  };

  // ── A1 revenue over time by channel (net of refunds by refund date) ───────
  function revenueByChannel(ctx, opts) {
    const g = opts.grain || 'day', b = seriesBase(opts);
    const series = {}; CHANNELS.forEach((c) => { series[c] = b.zeros(); });
    for (const r of filterRows(ctx.rows, opts)) {
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i == null) continue;
      series[channelOfRow(r)][i] += num(r.grossGbp);
    }
    const byId = rowById(ctx.rows);
    for (const f of refundsIn(ctx, opts)) {
      const i = b.idx.get(bucketKey(f.created, g)); if (i == null) continue;
      series[channelOfRow(byId.get(f.paymentIntent) || {})][i] -= num(f.amountGbp);
    }
    CHANNELS.forEach((c) => { series[c] = series[c].map(round2); });
    const totals = {}; CHANNELS.forEach((c) => { totals[c] = round2(sum(series[c])); });
    const rows = b.keys.map((k, i) => { const o = { bucket: k }; CHANNELS.forEach((c) => { o[c] = series[c][i]; }); o.total = round2(CHANNELS.reduce((s, c) => s + series[c][i], 0)); return o; });
    return { keys: b.keys, labels: b.labels, channels: CHANNELS, channelLabel: CHANNEL_LABEL, series, totals, total: round2(sum(Object.values(totals))), rows };
  }

  // ── A2 orders vs revenue ──────────────────────────────────────────────────
  function ordersVsRevenue(ctx, opts) {
    const g = opts.grain || 'day', b = seriesBase(opts);
    const orders = b.zeros(), revenue = b.zeros();
    for (const r of filterRows(ctx.rows, opts)) {
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i == null) continue;
      orders[i] += 1; revenue[i] += num(r.grossGbp);
    }
    for (const f of refundsIn(ctx, opts)) { const i = b.idx.get(bucketKey(f.created, g)); if (i != null) revenue[i] -= num(f.amountGbp); }
    const rows = b.keys.map((k, i) => ({ bucket: k, orders: orders[i], revenue: round2(revenue[i]) }));
    return { keys: b.keys, labels: b.labels, orders, revenue: revenue.map(round2), rows };
  }

  // ── A3 AOV trend + rolling mean ───────────────────────────────────────────
  function aovSeries(ctx, opts) {
    const g = opts.grain || 'day', b = seriesBase(opts), rollingDays = opts.rollingDays || 30;
    const n = b.zeros(), v = b.zeros();
    const chan = rowsByChannel(ctx.rows || [], opts.channel);
    for (const r of filterRows(ctx.rows, opts)) {
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i == null) continue;
      n[i] += 1; v[i] += num(r.grossGbp);
    }
    const aov = b.keys.map((k, i) => (n[i] ? round2(v[i] / n[i]) : null));
    const rolling = b.keys.map((k) => {
      const end = bucketEnd(k, g), start = addDays(end, -(rollingDays - 1));
      let c = 0, t = 0;
      for (const r of chan) { const d = rowDate(r); if (d >= start && d <= end) { c++; t += num(r.grossGbp); } }
      return c ? round2(t / c) : null;
    });
    const all = filterRows(ctx.rows, opts);
    const current = all.length ? round2(sum(all, (r) => r.grossGbp) / all.length) : null;
    const baseline = opts.baseline != null ? num(opts.baseline) : 135;
    const rows = b.keys.map((k, i) => ({ bucket: k, orders: n[i], aov: aov[i], rolling: rolling[i] }));
    return { keys: b.keys, labels: b.labels, aov, rolling, current, baseline, vsBaseline: current != null && baseline ? round2((current - baseline) / baseline * 100) : null, rows };
  }

  // ── A6 cumulative revenue vs target ───────────────────────────────────────
  function cumulativeRevenue(ctx, opts) {
    const b = seriesBase({ ...opts, grain: 'day' });
    const daily = b.zeros();
    for (const r of filterRows(ctx.rows, opts)) { const i = b.idx.get(rowDate(r)); if (i != null) daily[i] += num(r.grossGbp); }
    for (const f of refundsIn(ctx, opts)) { const i = b.idx.get(dayKey(f.created)); if (i != null) daily[i] -= num(f.amountGbp); }
    let run = 0; const cumulative = daily.map((d) => round2(run += d));
    const target = num(opts.target);
    const rows = b.keys.map((k, i) => ({ bucket: k, revenue: round2(daily[i]), cumulative: cumulative[i], target }));
    return { keys: b.keys, labels: b.labels, cumulative, target, total: cumulative.length ? cumulative[cumulative.length - 1] : 0, rows };
  }

  // ── B9 revenue & units by SKU with drill-down ─────────────────────────────
  function bySku(ctx, opts) {
    const level = opts.level || 'product', parent = opts.parent || null;
    const map = new Map();
    for (const r of filterRows(ctx.rows, opts)) {
      for (const it of r.items || []) {
        const m = skuMeta(it.handle, it.name);
        const size = it.size || '—';
        let key, label;
        if (level === 'product') { key = m.product; label = m.product; }
        else if (level === 'colourway') { if (parent && m.product !== parent) continue; key = `${m.product}|${m.colourway}`; label = m.colourway === '—' ? m.product : m.colourway; }
        else { const pk = `${m.product}|${m.colourway}`; if (parent && pk !== parent) continue; key = `${pk}|${size}`; label = size; }
        const cur = map.get(key) || { key, label, units: 0, revenue: 0, orders: new Set(), handle: it.handle };
        cur.units += num(it.qty); cur.revenue += num(it.lineGbp); cur.orders.add(r.id);
        map.set(key, cur);
      }
    }
    const metric = opts.metric === 'revenue' ? 'revenue' : 'units';
    const rows = [...map.values()].map((x) => ({ key: x.key, label: x.label, handle: x.handle, units: x.units, revenue: round2(x.revenue), orders: x.orders.size }))
      .sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label));
    return { level, parent, metric, rows, totalUnits: sum(rows, (x) => x.units), totalRevenue: round2(sum(rows, (x) => x.revenue)) };
  }

  // ── B10 sell-through + weeks of cover ─────────────────────────────────────
  /* Stock-held channels only (retail + wholesale): club kit is made to order.
     received = ctx.received batches [{handle,size,qty,date,unitCost}]; when a
     handle has none, received is IMPLIED as sold + on hand (flagged). */
  function sellThrough(ctx, opts) {
    const asOf = opts.asOf || keyOf(new Date());
    const since28 = addDays(asOf, -27);
    const per = new Map();
    const get = (h) => { let x = per.get(h); if (!x) { x = { handle: h, name: titleCase(h), sold: 0, sold28: 0, received: 0, stock: 0, sizes: new Map() }; per.set(h, x); } return x; };
    const sz = (x, s) => { let y = x.sizes.get(s); if (!y) { y = { size: s, sold: 0, sold28: 0, received: 0, stock: 0 }; x.sizes.set(s, y); } return y; };
    for (const r of ctx.rows || []) {
      const c = channelOfRow(r); if (c !== 'retail' && c !== 'wholesale') continue;
      const d = rowDate(r); if (d > asOf) continue;
      for (const it of r.items || []) {
        if (!it.handle) continue;
        const x = get(it.handle); if (it.name) x.name = it.name;
        const q = num(it.qty); x.sold += q; if (d >= since28) x.sold28 += q;
        const y = sz(x, it.size || '—'); y.sold += q; if (d >= since28) y.sold28 += q;
      }
    }
    for (const b of ctx.received || []) { if (!b.handle) continue; const x = get(b.handle); x.received += num(b.qty); sz(x, b.size || '—').received += num(b.qty); x.explicit = true; }
    for (const s of ctx.stockNow || []) { if (!s.handle || !per.has(s.handle) && !num(s.quantity)) continue; const x = get(s.handle); x.stock += num(s.quantity); sz(x, s.size || '—').stock += num(s.quantity); }
    const finish = (x) => {
      const received = x.explicit ? x.received : x.sold + x.stock;
      const weeklyRate = x.sold28 / 4;
      const weeks = x.stock > 0 ? (weeklyRate > 0 ? round2(x.stock / weeklyRate) : null) : 0;
      const status = weeks == null ? (x.stock > 0 ? 'static' : 'out') : weeks < 4 ? 'red' : weeks < 8 ? 'amber' : 'ok';
      return { received, implied: !x.explicit, sellThrough: received ? round2(x.sold / received * 100) : null, weeklyRate: round2(weeklyRate), weeksOfCover: weeks, status };
    };
    const rows = [...per.values()].map((x) => ({
      handle: x.handle, name: x.name, sold: x.sold, sold28: x.sold28, stock: x.stock, ...finish(x),
      sizes: [...x.sizes.values()].map((y) => ({ ...y, ...finish({ ...y, explicit: x.explicit }) })),
    })).sort((a, b) => b.sold - a.sold);
    return { asOf, rows };
  }

  // ── C15 new vs returning + repeat rate ────────────────────────────────────
  function firstOrders(rows) {
    const first = new Map();
    const sorted = [...(rows || [])].filter((r) => customerKey(r)).sort((a, b) => (rowDate(a) + a.id).localeCompare(rowDate(b) + b.id));
    for (const r of sorted) { const k = customerKey(r); if (!first.has(k)) first.set(k, r.id); }
    return first;   // customerKey → id of their first paid order
  }
  function newVsReturning(ctx, opts) {
    const g = opts.grain || 'month', b = seriesBase({ ...opts, grain: g });
    const first = firstOrders(ctx.rows);
    const fresh = b.zeros(), returning = b.zeros(), unknown = b.zeros();
    for (const r of filterRows(ctx.rows, opts)) {
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i == null) continue;
      const k = customerKey(r);
      if (!k) unknown[i] += 1; else if (first.get(k) === r.id) fresh[i] += 1; else returning[i] += 1;
    }
    const rows = b.keys.map((k, i) => ({ bucket: k, new: fresh[i], returning: returning[i], unknown: unknown[i] }));
    return { keys: b.keys, labels: b.labels, new: fresh, returning, unknown, rows };
  }
  function repeatRate(ctx, opts) {
    const rows = rowsByChannel(ctx.rows || [], opts && opts.channel);
    const counts = new Map();
    for (const r of rows) { const k = customerKey(r); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
    const customers = counts.size, repeaters = [...counts.values()].filter((n) => n >= 2).length;
    return { customers, repeaters, rate: customers ? round2(repeaters / customers * 100) : null };
  }

  // ── C19 geography ─────────────────────────────────────────────────────────
  function geo(ctx, opts) {
    const countries = new Map(), areas = new Map();
    for (const r of filterRows(ctx.rows, opts)) {
      const c = String(r.country || '').toUpperCase() || 'Unknown';
      const x = countries.get(c) || { country: c, orders: 0, revenue: 0 }; x.orders++; x.revenue += num(r.grossGbp); countries.set(c, x);
      if (c === 'GB') { const a = r.postcodeArea || 'Unknown'; const y = areas.get(a) || { area: a, orders: 0, revenue: 0 }; y.orders++; y.revenue += num(r.grossGbp); areas.set(a, y); }
    }
    const fin = (m) => [...m.values()].map((x) => ({ ...x, revenue: round2(x.revenue) })).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
    return { countries: fin(countries), ukAreas: fin(areas) };
  }

  // ── D21 attribution ───────────────────────────────────────────────────────
  function attribution(ctx, opts) {
    const g = opts.grain || 'month', b = seriesBase({ ...opts, grain: g });
    const series = new Map(), totals = new Map();
    for (const r of filterRows(ctx.rows, opts)) {
      const src = attributionBucket(r);
      if (!series.has(src)) series.set(src, b.zeros());
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i != null) series.get(src)[i] += num(r.grossGbp);
      const t = totals.get(src) || { source: src, label: attrLabel(src), orders: 0, revenue: 0 }; t.orders++; t.revenue += num(r.grossGbp); totals.set(src, t);
    }
    const order = [...totals.values()].sort((a, b) => b.revenue - a.revenue);
    const sources = order.map((t) => t.source);
    const out = {}; sources.forEach((s) => { out[s] = series.get(s).map(round2); });
    const rows = b.keys.map((k, i) => { const o = { bucket: k }; sources.forEach((s) => { o[s] = out[s][i]; }); return o; });
    return { keys: b.keys, labels: b.labels, sources, sourceLabel: Object.fromEntries(sources.map((s) => [s, attrLabel(s)])), series: out, totals: order.map((t) => ({ ...t, revenue: round2(t.revenue) })), rows };
  }

  // ── D22 Meta spend vs attributed revenue → ROAS, CAC ──────────────────────
  function roas(ctx, opts) {
    const g = opts.grain || 'day', b = seriesBase(opts);
    const spend = b.zeros(), revenue = b.zeros(), proxy = b.zeros();
    for (const s of ctx.spend || []) { const i = b.idx.get(bucketKey(s.date, g)); if (i != null) spend[i] += num(s.spend); }
    const first = firstOrders(ctx.rows);
    let newCustomers = 0, attributedOrders = 0;
    for (const r of filterRows(ctx.rows, opts)) {
      const src = attributionBucket(r);
      const i = b.idx.get(bucketKey(rowDate(r), g)); if (i == null) continue;
      if (isMetaSource(src)) { revenue[i] += num(r.grossGbp); attributedOrders++; const k = customerKey(r); if (k && first.get(k) === r.id) newCustomers++; }
      else if (src === 'meta-click') proxy[i] += num(r.grossGbp);
    }
    const tSpend = round2(sum(spend)), tRev = round2(sum(revenue));
    const rows = b.keys.map((k, i) => ({ bucket: k, spend: round2(spend[i]), revenue: round2(revenue[i]), roas: spend[i] ? round2(revenue[i] / spend[i]) : null }));
    return { keys: b.keys, labels: b.labels, spend: spend.map(round2), revenue: revenue.map(round2), roas: rows.map((x) => x.roas),
      totals: { spend: tSpend, revenue: tRev, roas: tSpend ? round2(tRev / tSpend) : null, attributedOrders, newCustomers, cac: newCustomers ? round2(tSpend / newCustomers) : null, proxyRevenue: round2(sum(proxy)) }, rows };
  }

  // ── E26 funnel (GA4 users per step; purchase step from Stripe) ────────────
  const FUNNEL_STEPS = [['page_view', 'Page view'], ['view_item', 'View product'], ['add_to_cart', 'Add to cart'], ['begin_checkout', 'Begin checkout'], ['purchase', 'Purchase']];
  function funnel(ctx, opts) {
    const days = ((ctx.ga4 && ctx.ga4.days) || []).filter((d) => inRange(dayKey(d.date), opts.from, opts.to));
    const purchases = filterRows(ctx.rows, { ...opts, channel: 'all' }).filter((r) => r.source !== 'wholesale').length;   // site purchases only
    const steps = FUNNEL_STEPS.map(([key, label]) => {
      const users = key === 'purchase' ? purchases : sum(days, (d) => (d[key] && d[key].users) || 0);
      const events = key === 'purchase' ? purchases : sum(days, (d) => (d[key] && d[key].events) || 0);
      return { key, label, users, events, source: key === 'purchase' ? 'stripe' : 'ga4' };
    });
    steps.forEach((s, i) => { s.pctOfFirst = steps[0].users ? round2(s.users / steps[0].users * 100) : null; s.pctOfPrev = i ? (steps[i - 1].users ? round2(s.users / steps[i - 1].users * 100) : null) : 100; });
    return { steps, days: days.length, configured: !!(ctx.ga4 && ctx.ga4.days), rows: steps.map((s) => ({ step: s.label, users: s.users, pctOfFirst: s.pctOfFirst, pctOfPrev: s.pctOfPrev })) };
  }

  // ── F30 refunds & disputes by SKU / size ──────────────────────────────────
  function refundsBySku(ctx, opts) {
    const byId = rowById(ctx.rows);
    const events = [];
    for (const f of refundsIn(ctx, opts)) events.push({ type: 'refund', id: f.id, date: dayKey(f.created), paymentIntent: f.paymentIntent, amount: num(f.amountGbp), reason: f.reason || '', status: f.status || 'succeeded' });
    for (const d of ctx.disputes || []) {
      if (!inRange(dayKey(d.created), opts.from, opts.to)) continue;
      const r = byId.get(d.paymentIntent);
      if (opts.channel && opts.channel !== 'all' && channelOfRow(r || {}) !== opts.channel) continue;
      if (String(d.status || '').startsWith('warning_')) continue;   // inquiry, not money
      events.push({ type: 'dispute', id: d.id, date: dayKey(d.created), paymentIntent: d.paymentIntent, amount: d.status === 'lost' ? num(d.amountGbp) : 0, reason: d.reason || '', status: d.status || '' });
    }
    const bySku = new Map(), bySize = new Map();
    const table = events.map((e) => {
      const r = byId.get(e.paymentIntent);
      const items = (r && r.items) || [];
      const lineTotal = sum(items, (it) => it.lineGbp) || sum(items, (it) => it.qty);
      for (const it of items) {
        const share = lineTotal ? (num(it.lineGbp) || num(it.qty)) / lineTotal : 1 / items.length;
        const amt = e.amount * share;
        const m = skuMeta(it.handle, it.name);
        const sk = `${m.product}|${m.colourway}`;
        const x = bySku.get(sk) || { key: sk, label: m.colourway === '—' ? m.product : `${m.product} · ${m.colourway}`, handle: it.handle, count: 0, amount: 0 }; x.count++; x.amount += amt; bySku.set(sk, x);
        const s = it.size || '—'; const y = bySize.get(s) || { size: s, count: 0, amount: 0 }; y.count++; y.amount += amt; bySize.set(s, y);
      }
      return { ...e, amount: round2(e.amount), channel: channelOfRow(r || {}), customer: r ? r.email : '', items: items.map((it) => `${it.name || titleCase(it.handle)} (${it.size || '—'}) ×${it.qty}`).join(', '), orderDate: r ? rowDate(r) : '' };
    }).sort((a, b) => b.date.localeCompare(a.date));
    const fin = (m) => [...m.values()].map((x) => ({ ...x, amount: round2(x.amount) })).sort((a, b) => b.amount - a.amount);
    return { bySku: fin(bySku), bySize: fin(bySize), table, totals: { count: events.length, amount: round2(sum(events, (e) => e.amount)), refunds: events.filter((e) => e.type === 'refund').length, disputes: events.filter((e) => e.type === 'dispute').length } };
  }

  // ── F33 payouts & balance ─────────────────────────────────────────────────
  function payoutsSeries(ctx, opts) {
    const g = opts.grain || 'week', b = seriesBase({ ...opts, grain: g });
    const paid = b.zeros(), pending = b.zeros();
    const rows = [];
    for (const p of ctx.payouts || []) {
      if (p.status === 'failed' || p.status === 'canceled') continue;
      const d = dayKey(p.arrivalDate || p.created);
      if (!inRange(d, opts.from, opts.to)) continue;
      const i = b.idx.get(bucketKey(d, g)); if (i == null) continue;
      (p.status === 'paid' ? paid : pending)[i] += num(p.amount);
      rows.push({ id: p.id, arrivalDate: d, amount: round2(p.amount), currency: p.currency || 'gbp', status: p.status });
    }
    const bal = ctx.balance || {};
    const tot = (list) => round2(sum(list || [], (x) => (x.currency || 'gbp') === 'gbp' ? x.amount : 0));
    return { keys: b.keys, labels: b.labels, paid: paid.map(round2), pending: pending.map(round2), rows: rows.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)),
      balance: { available: tot(bal.available), pending: tot(bal.pending), detail: bal } };
  }

  // ── F35 rolling-12-month turnover vs the VAT threshold ────────────────────
  /* VAT turnover = gross taxable turnover: what customers paid incl. shipping,
     less refunds — every channel, never Stripe `net`. */
  function turnoverAt(ctx, asOf) {
    const from = addDays(asOf, -364);
    let t = 0;
    for (const r of ctx.rows || []) { const d = rowDate(r); if (d >= from && d <= asOf) t += num(r.grossGbp); }
    for (const f of ctx.refunds || []) { if (!okRefund(f)) continue; const d = dayKey(f.created); if (d >= from && d <= asOf) t -= num(f.amountGbp); }
    return round2(t);
  }
  function rolling12(ctx, opts) {
    opts = opts || {};
    const asOf = opts.asOf || keyOf(new Date()), threshold = opts.threshold || VAT_THRESHOLD, runRateDays = opts.runRateDays || 90;
    const turnover = turnoverAt(ctx, asOf);
    const runFrom = addDays(asOf, -(runRateDays - 1));
    let recent = 0;
    for (const r of ctx.rows || []) { const d = rowDate(r); if (d >= runFrom && d <= asOf) recent += num(r.grossGbp); }
    for (const f of ctx.refunds || []) { if (!okRefund(f)) continue; const d = dayKey(f.created); if (d >= runFrom && d <= asOf) recent -= num(f.amountGbp); }
    const runRatePerDay = round2(recent / runRateDays);
    const projectedCrossing = turnover >= threshold ? asOf : (runRatePerDay > 0 ? addDays(asOf, Math.ceil((threshold - turnover) / runRatePerDay)) : null);
    const series = [];
    const [ay, am] = asOf.slice(0, 7).split('-').map(Number);
    for (let i = 11; i >= 1; i--) { const k = keyOf(new Date(Date.UTC(ay, am - i, 0))); series.push({ key: k, turnover: turnoverAt(ctx, k) }); }   // last day of each of the previous 11 months
    series.push({ key: asOf, turnover });
    const status = turnover >= VAT_RED ? 'red' : turnover >= VAT_AMBER ? 'amber' : 'ok';
    return { asOf, turnover, threshold, pct: round2(turnover / threshold * 100), status, amberAt: VAT_AMBER, redAt: VAT_RED, runRatePerDay, projectedCrossing, headroom: round2(threshold - turnover), series, rows: series.map((s) => ({ asOf: s.key, turnover: s.turnover, threshold })) };
  }

  // ── costs → gross margin ──────────────────────────────────────────────────
  /* costs = { unitCost:{handle:£}, clubUnitCost:{clubHandle:£} }. Retail and
     wholesale lines cost at the landed unit cost; club lines at the club's
     production cost per unit (the dashboard derives it from the linked
     pipeline order). A row with any un-costed line is reported, not guessed. */
  function cogsOfRow(r, costs) {
    costs = costs || {}; const uc = costs.unitCost || {}, cc = costs.clubUnitCost || {};
    let cogs = 0, uncosted = 0;
    for (const it of r.items || []) {
      const c = channelOfRow(r) === 'club' ? cc[r.clubHandle] : uc[it.handle];
      if (c == null || c === '') { uncosted++; continue; }
      cogs += num(c) * num(it.qty);
    }
    return { cogs: round2(cogs), uncosted, costed: !uncosted && (r.items || []).length > 0 };
  }
  const goodsRevenue = (r) => num(r.grossGbp) - num(r.shippingGbp) - num(r.refundedGbp);
  function grossMargin(ctx, opts) {
    let rev = 0, cogs = 0, costed = 0, uncosted = 0;
    for (const r of filterRows(ctx.rows, opts)) {
      const c = cogsOfRow(r, ctx.costs);
      if (!c.costed) { uncosted++; continue; }
      costed++; rev += goodsRevenue(r); cogs += c.cogs;
    }
    return { revenue: round2(rev), cogs: round2(cogs), margin: rev ? round2((rev - cogs) / rev * 100) : null, costed, uncosted };
  }

  // ── headline KPI tiles ────────────────────────────────────────────────────
  function kpis(ctx, opts) {
    opts = opts || {};
    const asOf = opts.asOf || keyOf(new Date());
    const mtd = { from: monthStart(asOf), to: asOf, channel: opts.channel };
    const lmEnd = addDays(monthStart(asOf), -1), lm = { from: monthStart(lmEnd), to: lmEnd, channel: opts.channel };
    const lmSameDay = { from: monthStart(lmEnd), to: (() => { const d = Math.min(+asOf.slice(8, 10), +lmEnd.slice(8, 10)); return lmEnd.slice(0, 8) + String(d).padStart(2, '0'); })(), channel: opts.channel };
    const netRev = (o) => round2(sum(filterRows(ctx.rows, o), (r) => r.grossGbp) - sum(refundsIn(ctx, o), (f) => f.amountGbp));
    const revenueMtd = netRev(mtd), revenueLastMonth = netRev(lm), revenueLastMonthToDate = netRev(lmSameDay);
    const ordersMtd = filterRows(ctx.rows, mtd).length;
    const range = filterRows(ctx.rows, opts);
    const grossRange = sum(range, (r) => r.grossGbp);
    const refundedRange = sum(refundsIn(ctx, opts), (f) => f.amountGbp);
    const refundedOrders = range.filter((r) => num(r.refundedGbp) > 0).length;
    const aov = range.length ? round2(grossRange / range.length) : null;
    const baseline = opts.baseline != null ? num(opts.baseline) : 135;
    const gm = grossMargin(ctx, opts);
    const rr = repeatRate(ctx, opts);
    const r12 = rolling12(ctx, { asOf });
    const ro = roas(ctx, { ...opts, grain: 'month' });
    const bal = payoutsSeries(ctx, { from: asOf, to: asOf, grain: 'day' }).balance;
    return {
      asOf,
      revenueMtd, revenueLastMonth, revenueLastMonthToDate,
      revenueDelta: revenueLastMonth ? round2((revenueMtd - revenueLastMonth) / revenueLastMonth * 100) : null,
      revenueDeltaToDate: revenueLastMonthToDate ? round2((revenueMtd - revenueLastMonthToDate) / revenueLastMonthToDate * 100) : null,
      ordersMtd,
      aov, aovBaseline: baseline, aovVsBaseline: aov != null && baseline ? round2((aov - baseline) / baseline * 100) : null,
      grossMargin: gm,
      refundRate: grossRange ? round2(refundedRange / grossRange * 100) : null, refundedRange: round2(refundedRange), refundedOrders, ordersRange: range.length,
      repeat: rr,
      balance: bal,
      rolling12: r12,
      roas: ro.totals,
    };
  }

  // ── G37 per-club cards ────────────────────────────────────────────────────
  function currentWindow(list, asOf) {
    const ws = (list || []).filter((w) => w.start && w.end);
    return ws.find((w) => w.start <= asOf && asOf <= w.end)
      || [...ws].filter((w) => w.end < asOf).sort((a, b) => b.end.localeCompare(a.end))[0]
      || [...ws].filter((w) => w.start > asOf).sort((a, b) => a.start.localeCompare(b.start))[0]
      || null;
  }
  function clubCards(ctx, opts) {
    opts = opts || {};
    const asOf = opts.asOf || keyOf(new Date());
    const windows = ctx.windows || {};
    const clubs = new Map();
    for (const r of ctx.rows || []) {
      if (channelOfRow(r) !== 'club') continue;
      const h = r.clubHandle || ('name:' + String(r.club || '').trim().toLowerCase());
      const c = clubs.get(h) || { clubHandle: h, club: r.club || h, rows: [] }; c.rows.push(r); if (r.club) c.club = r.club; clubs.set(h, c);
    }
    const cards = [];
    for (const c of clubs.values()) {
      const w = opts.windowId ? (windows[c.clubHandle] || []).find((x) => x.id === opts.windowId) : currentWindow(windows[c.clubHandle], asOf);
      const inWin = w ? c.rows.filter((r) => inRange(rowDate(r), w.start, w.end)) : c.rows;
      const byProduct = new Map();
      let units = 0, value = 0;
      for (const r of inWin) {
        value += num(r.grossGbp) - num(r.shippingGbp);
        for (const it of r.items || []) { const p = byProduct.get(it.handle) || { handle: it.handle, name: it.name || titleCase(it.handle), units: 0, sizes: {} }; p.units += num(it.qty); p.sizes[it.size || '—'] = (p.sizes[it.size || '—'] || 0) + num(it.qty); byProduct.set(it.handle, p); units += num(it.qty); }
      }
      const start = w ? w.start : (inWin.length ? inWin.map(rowDate).sort()[0] : asOf);
      const end = w ? (w.end > asOf ? w.end : w.end) : asOf;
      const keys = bucketsBetween(start, end >= asOf ? end : asOf, 'day');
      const idx = new Map(keys.map((k, i) => [k, i])); const daily = keys.map(() => 0);
      for (const r of inWin) { const i = idx.get(rowDate(r)); if (i != null) daily[i]++; }
      let run = 0; const cumulative = daily.map((d) => (run += d));
      cards.push({ clubHandle: c.clubHandle, club: c.club, window: w ? { id: w.id, label: w.label, start: w.start, end: w.end } : null,
        orders: inWin.length, units, value: round2(value), daysLeft: w ? daysBetween(asOf, w.end) : null, open: !!w && w.start <= asOf && asOf <= w.end,
        byProduct: [...byProduct.values()].sort((a, b) => b.units - a.units),
        curve: { keys, cumulative, deadlineIndex: w ? idx.get(w.end) ?? null : null, todayIndex: idx.get(asOf) ?? null } });
    }
    return cards.sort((a, b) => (b.open - a.open) || b.orders - a.orders);
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  function toCSV(rows, cols) {
    const cs = (cols || (rows[0] ? Object.keys(rows[0]) : [])).map((c) => (typeof c === 'string' ? { key: c, label: c } : c));
    const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cs.map((c) => cell(c.label)).join(',')].concat((rows || []).map((r) => cs.map((c) => cell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))).join('\r\n');
  }

  return {
    VAT_THRESHOLD, VAT_AMBER, VAT_RED, META_SOURCES, CHANNELS, CHANNEL_LABEL, SKU_GROUPS, FUNNEL_STEPS,
    num, round2, sum, fmtGBP, fmtPct, titleCase, normEmail, normPhone, customerKey,
    dayKey, addDays, mondayOf, monthStart, monthEnd, daysBetween, bucketKey, bucketEnd, bucketsBetween, bucketLabel, rowDate, inRange,
    channelOfRow, channelOfMeta, attributionOfMeta, attributionBucket, attrLabel, isMetaSource, postcodeArea, regionCountry, skuMeta,
    filterRows, refundsIn,
    revenueByChannel, ordersVsRevenue, aovSeries, cumulativeRevenue, bySku, sellThrough, newVsReturning, repeatRate, geo, attribution, roas, funnel, refundsBySku, payoutsSeries, turnoverAt, rolling12, cogsOfRow, grossMargin, kpis, currentWindow, clubCards, toCSV,
  };
})();
if (typeof module === 'object' && module.exports) module.exports = AnalyticsCore;
/* ANALYTICS-CORE-END */

let an = { rows:null, refunds:[], disputes:[], treasury:null, funnel:null, loaded:false, syncing:false, status:"", error:"", inputsOpen:false, table:{}, b9:{level:"product", parent:null, metric:"units"}, g37:{} };

/* ---- cache: IndexedDB with a localStorage fallback (Safari refuses IDB on file://) ---- */
const anDb = (()=>{
  const STORES=["orders","refunds","disputes"];
  let dbp=null;
  function open(){
    if(dbp) return dbp;
    dbp=new Promise((res,rej)=>{ try{
      const r=indexedDB.open(AN_DB,1);
      r.onupgradeneeded=()=>{ const d=r.result; STORES.forEach(s=>{ if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:"id"}); }); };
      r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); r.onblocked=()=>rej(new Error("blocked"));
    }catch(e){ rej(e); } });
    return dbp;
  }
  const lsKey=(s)=>AN_DB+":"+s;
  function lsGet(s){ try{ return JSON.parse(localStorage.getItem(lsKey(s)))||[]; }catch(e){ return []; } }
  function lsMerge(s, items){ const m=new Map(lsGet(s).map(x=>[x.id,x])); items.forEach(x=>m.set(x.id,x)); const str=JSON.stringify([...m.values()]); if(str.length>4000000){ console.warn("analytics cache too large for localStorage"); return; } try{ localStorage.setItem(lsKey(s), str); }catch(e){} }
  async function all(s){ try{ const d=await open(); return await new Promise((res,rej)=>{ const q=d.transaction(s,"readonly").objectStore(s).getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=()=>rej(q.error); }); }catch(e){ return lsGet(s); } }
  async function put(s, items){ if(!items||!items.length) return; try{ const d=await open(); await new Promise((res,rej)=>{ const tx=d.transaction(s,"readwrite"); const os=tx.objectStore(s); items.forEach(x=>os.put(x)); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }catch(e){ lsMerge(s, items); } }
  async function del(s, ids){ if(!ids||!ids.length) return; try{ const d=await open(); await new Promise((res,rej)=>{ const tx=d.transaction(s,"readwrite"); const os=tx.objectStore(s); ids.forEach(id=>os.delete(id)); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }catch(e){ const keep=lsGet(s).filter(x=>!ids.includes(x.id)); try{ localStorage.setItem(lsKey(s), JSON.stringify(keep)); }catch(e2){} } }
  async function clear(){ try{ const d=await open(); await Promise.all(STORES.map(s=>new Promise((res,rej)=>{ const tx=d.transaction(s,"readwrite"); tx.objectStore(s).clear(); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }))); }catch(e){} STORES.forEach(s=>{ try{ localStorage.removeItem(lsKey(s)); }catch(e){} }); }
  return { all, put, del, clear };
})();

/* ---- backend ---- */
async function anFetch(params){
  const key=localStorage.getItem(WS_KEY_STORE); if(!key) throw new Error("nokey");
  const qs=new URLSearchParams({ key, ...params });
  const res=await fetch(`${BACKEND}/api/analytics?${qs}`);
  if(res.status===403) throw new Error("badkey");
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body.error||("Backend error "+res.status));
  return body;
}
const anUnix=(key)=>Math.floor(Date.parse(key+"T00:00:00Z")/1000);
/* Walk [since, now] in AN_WINDOW_DAYS windows, oldest first. */
async function anWalk(sinceUnix, extra, onProgress){
  const now=Math.floor(Date.now()/1000); const out=[]; let serverTime=null;
  for(let s=sinceUnix; s<=now; s+=AN_WINDOW_DAYS*86400){
    const u=Math.min(s+AN_WINDOW_DAYS*86400-1, now);
    const body=await anFetch({ scope:"orders", since:String(s), until:String(u), ...extra });
    out.push(...(body.orders||[])); serverTime=body.serverTime||serverTime;
    if(onProgress) onProgress(out.length, u);
  }
  return { orders:out, serverTime };
}
/* Bank-transfer SHOP rows (backend bankRow) count as revenue from the day the
   order was placed, paid or not: the row is dated by `created`; the real tick
   date is kept as `receivedAt` and `unpaid` says the transfer is still awaited. */
const AN_BANK_PM = "Bank transfer (shop)";
function anBankNorm(r){
  if(!r || r.paymentMethod!==AN_BANK_PM || !r.created) return r;
  const received = ("receivedAt" in r)? r.receivedAt : (r.paidAt||null);
  return { ...r, receivedAt:received, unpaid:!received, paidAt:r.created };
}
async function anLoadCache(){
  an.rows=(await anDb.all("orders")).filter(r=>r && !r.void).map(anBankNorm); an.refunds=await anDb.all("refunds"); an.disputes=await anDb.all("disputes"); an.loaded=true;
}
async function anSync(opts){
  opts=opts||{};
  if(an.syncing) return;
  an.syncing=true; an.error=""; an.status="Checking the backend…"; anPaintStatus();
  try{
    if(!ws.data && !ws.loading && localStorage.getItem(WS_KEY_STORE)) await wsLoad();
    if(!wsBackendCan("analytics")) throw new Error("The live backend doesn't have the analytics endpoint yet — merge the analytics branch, wait for the deploy, then Sync again.");
    if(opts.full){ await anDb.clear(); anInputs.lastSync=null; anInputs.liteScanAt=null; }
    const first=!anInputs.lastSync;
    const since= first? anUnix(AN_START) : Math.floor(Date.parse(anInputs.lastSync)/1000)-86400;
    const got=await anWalk(since, {}, (n,u)=>{ an.status=`Syncing orders… ${n} so far (to ${fmtDate(new Date(u*1000).toISOString())})`; anPaintStatus(); });
    /* a bank-transfer order cancelled since the last sync comes back as { id, void:true } */
    const gone=got.orders.filter(r=>r.void).map(r=>r.id);
    await anDb.put("orders", got.orders.filter(r=>!r.void));
    if(gone.length) await anDb.del("orders", gone);
    an.status="Syncing refunds and disputes…"; anPaintStatus();
    const ch=await anFetch({ scope:"changes", since:String(since) });
    await anDb.put("refunds", ch.refunds||[]); await anDb.put("disputes", ch.disputes||[]);
    const liteDue = !first && (!anInputs.liteScanAt || Date.now()-Date.parse(anInputs.liteScanAt) > AN_LITE_EVERY_DAYS*86400000);
    if(liteDue){
      an.status="Weekly re-scan of dispatch and refund state…"; anPaintStatus();
      const lite=await anWalk(anUnix(AN_START), { lite:"1" });
      const cur=new Map((await anDb.all("orders")).map(r=>[r.id,r])); const upd=[];
      const dead=[];   /* bank-transfer rows cancelled since they were synced (an un-tick only flips them back to unpaid) */
      for(const l of lite.orders){ const r=cur.get(l.id); if(!r) continue; if(l.void){ dead.push(l.id); continue; } Object.assign(r, { refundedGbp:l.refundedGbp, tracking:l.tracking, productionAt:l.productionAt, dispatchedAt:l.dispatchedAt, deliveredAt:l.deliveredAt }); if(r.paymentMethod===AN_BANK_PM && "paidAt" in l){ r.paidAt=l.paidAt; r.unpaid=!l.paidAt; delete r.receivedAt; } upd.push(r); }
      await anDb.put("orders", upd);
      if(dead.length) await anDb.del("orders", dead);
      anInputs.liteScanAt=new Date().toISOString();
    }
    if(first) anInputs.liteScanAt=new Date().toISOString();
    const st = got.serverTime? Date.parse(got.serverTime) : Date.now();
    anInputs.lastSync=new Date(st-5*60000).toISOString();   /* 5-minute overlap for Stripe list consistency */
    anSaveInputs();
    an.status="Reading balance, payouts and GA4…"; anPaintStatus();
    an.treasury=await anFetch({ scope:"treasury" }).catch(e=>({ error:e.message }));
    an.funnel=await anFetch({ scope:"funnel", start:AN_START, end:today() }).catch(e=>({ error:e.message }));
    await anLoadCache();
    an.status="";
  }catch(e){
    an.error = e.message==="nokey"? "Set the admin key on Retail → Orders first (Change key)." : e.message==="badkey"? "The admin key was rejected — change it on Retail → Orders." : e.message;
    an.status="";
  }
  an.syncing=false; renderAnalytics();
}

/* ---- unified rows: Stripe cache + manual bank-transfer orders + wholesale invoices ---- */
function anListPrice(handle, name){ return PRICE[name||HANDLE_NAME[handle]] ?? PRICE[HANDLE_NAME[handle]] ?? 0; }
function anManualRows(){
  return manualOrders.filter(o=>!o.pipelineId).map(o=>{   /* parcel records carry no money */
    const retail=streamOf(o)==="retail";
    const amount=+o.amount||0;
    const lines=(Array.isArray(o.lineItems)? o.lineItems : []).filter(l=>l&&l.handle).map(l=>{
      const qty=+l.qty||0, name=l.name||HANDLE_NAME[l.handle]||l.handle;
      const unit= l.unitAmount!=null? l.unitAmount/100 : anListPrice(l.handle, name);
      return { handle:l.handle, name, size:l.size||"", qty, lineGbp:+(unit*qty).toFixed(2) };
    });
    const sumLines=lines.reduce((s,l)=>s+l.lineGbp,0);
    if(sumLines>0 && Math.abs(sumLines-amount)>0.01){ const k=amount/sumLines; lines.forEach(l=>{ l.lineGbp=+(l.lineGbp*k).toFixed(2); l.allocated=true; }); }
    const d=(o.date||"").slice(0,10); const iso= d? d+"T12:00:00Z" : null;
    const country=String((o.addr&&o.addr.country)||"").toUpperCase();
    return { id:o.id, source:"manual", ref:o.ref||o.id, sessionId:null, created:iso, paidAt:iso, availableOn:null, currency:"gbp",
      channel: retail? "retail" : "club", clubHandle:o.clubHandle||"", club:o.club||"", email:String(o.email||"").trim().toLowerCase(), phone:o.phone||"", name:o.name||"",
      country, postcodeArea:AnalyticsCore.postcodeArea(o.addr&&o.addr.postal_code, country||"GB"),
      gross:amount, grossGbp:amount, fee:0, net:amount, fx:1, shippingGbp:0, discountGbp:0, subtotalGbp:amount, promoCode:"", refundedGbp:0, dispute:null,
      items:lines, utm:{}, shippingMethod:wsServiceOf(o), delivery:o.service==="club"? "club" : o.service==="collection"? "collection" : "post",
      paymentMethod:o.paidVia||"manual", tracking:o.tracking||null, productionAt:o.productionAt||null, dispatchedAt:o.dispatchedAt||null, deliveredAt:o.deliveredAt||null };
  });
}
function anWholesaleRows(){
  return anInputs.wholesale.filter(w=>w.date).map(w=>{
    const iso=w.date+"T12:00:00Z";
    const priced=w.lines.map(l=>({ handle:l.handle, name:HANDLE_NAME[l.handle]||l.handle, size:l.size||"", qty:+l.qty||0, list:anListPrice(l.handle) }));
    const tot=priced.reduce((s,l)=>s+l.list*l.qty,0);
    const items=priced.map(l=>({ handle:l.handle, name:l.name, size:l.size, qty:l.qty, lineGbp:+(tot? w.amount*(l.list*l.qty)/tot : (priced.length? w.amount/priced.length : 0)).toFixed(2), allocated:true }));
    return { id:"wh_"+w.id, source:"wholesale", ref:w.ref||("Wholesale "+w.date), sessionId:null, created:iso, paidAt:iso, availableOn:null, currency:"gbp",
      channel:"wholesale", clubHandle:"", club:"", email:"", phone:"", name:w.customer||"Wholesale", country:"GB", postcodeArea:"",
      gross:+w.amount||0, grossGbp:+w.amount||0, fee:0, net:+w.amount||0, fx:1, shippingGbp:0, discountGbp:0, subtotalGbp:+w.amount||0, promoCode:"", refundedGbp:0, dispute:null,
      items, utm:{}, shippingMethod:"wholesale", delivery:"wholesale", paymentMethod:"invoice", tracking:null, productionAt:null, dispatchedAt:null, deliveredAt:null };
  });
}
/* Club invoices settled by bank transfer — pipeline orders recorded as paid by
   invoice with a paid date (Payment check / the delivered gate). The dashboard
   is their only record. One row per invoice, channel club, lines from the
   order's items scaled to the invoiced amount. Outstanding invoices (no paid
   date) are not rows yet. */
function anClubKey(o){ const nm=String(o.webshopClub||o.club||"").trim(); const e=csClubFor(nm); return (e&&e.handle)||("name:"+nm.toLowerCase()); }
function anInvoiceRows(){
  return orders.filter(invoicePaid).map(o=>{
    const amount=invoiceAmountOf(o), iso=o.invoicePaidDate+"T12:00:00Z";
    const em=String(o.email||"").trim().toLowerCase();
    const lines=(o.items||[]).filter(it=>it&&it.name&&+it.qty>0).map(it=>({ handle:NAME_HANDLE[it.name]||String(it.name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), name:it.name, size:it.spec||"", qty:+it.qty||0, lineGbp:+((+it.price||0)*(+it.qty||0)).toFixed(2) }));
    const sumLines=lines.reduce((s,l)=>s+l.lineGbp,0);
    if(sumLines>0 && Math.abs(sumLines-amount)>0.01){ const k=amount/sumLines; lines.forEach(l=>{ l.lineGbp=+(l.lineGbp*k).toFixed(2); l.allocated=true; }); }
    return { id:"inv_"+o.id, source:"invoice", ref:(o.club||"Club")+" — invoice", sessionId:null, created:iso, paidAt:iso, availableOn:null, currency:"gbp",
      channel:"club", clubHandle:anClubKey(o), club:o.club||"", email:/@/.test(em)? em : "", phone:/@/.test(em)? "" : em, name:o.contact||o.club||"",
      country:"GB", postcodeArea:"",
      gross:amount, grossGbp:amount, fee:0, net:amount, fx:1, shippingGbp:0, discountGbp:0, subtotalGbp:amount, promoCode:"", refundedGbp:0, dispute:null,
      items:lines, utm:{}, shippingMethod:"club", delivery:"club", paymentMethod:"Bank transfer", tracking:o.tracking||null, productionAt:null, dispatchedAt:null, deliveredAt:o.deliveredDate? o.deliveredDate+"T12:00:00Z" : null };
  });
}
/* Club production cost per unit — from the latest delivered pipeline order of
   each club (production cost ÷ units); keyed by the club's roster handle (or
   "name:<club>" for clubs without a shop — the invoice rows use the same key). */
function anClubUnitCosts(){
  const out={};
  const byName=new Map(); for(const r of an.rows||[]){ if(r.clubHandle && r.club) byName.set(String(r.club).trim().toLowerCase(), r.clubHandle); }
  const done=orders.filter(o=>o.stage==="delivered" && (o.webshopClub || invoicePaid(o)) && hasCost(o) && +o.qty>0)
    .sort((a,b)=>String(a.deliveredDate||"").localeCompare(String(b.deliveredDate||"")));
  for(const o of done){
    const nm=String(o.webshopClub||o.club||"").trim(), n=nm.toLowerCase();
    const e=csClubFor(nm); const key=(e&&e.handle)||byName.get(n)||("name:"+n);
    out[key]=+((+o.cost)/(+o.qty)).toFixed(2);
  }
  return out;
}
function anAllRows(){ return (an.rows||[]).concat(anManualRows(), anWholesaleRows(), anInvoiceRows()); }
function anCtx(){
  return { rows:anAllRows(), refunds:an.refunds||[], disputes:an.disputes||[],
    payouts:(an.treasury&&an.treasury.payouts)||[], balance:(an.treasury&&an.treasury.balance)||{},
    ga4:(an.funnel&&Array.isArray(an.funnel.days))? { days:an.funnel.days } : null,
    spend:anInputs.metaSpend, received:anInputs.received, stockNow:(stockState&&stockState.rows)||[],
    costs:{ unitCost:retailCosts.unitCost, clubUnitCost:anClubUnitCosts() },
    windows:(clubShopData&&clubShopData.windows)||{}, asOf:today() };
}

/* ---- filters (one row above everything) ---- */
function anUi(){ if(!uiState.an) uiState.an={ range:"30d", from:"", to:"", channel:"all", grain:"auto" }; return uiState.an; }
function anRange(){
  const u=anUi(), t=today();
  if(u.range==="custom" && u.from && u.to) return { from:u.from, to:u.to };
  if(u.range==="ytd") return { from:t.slice(0,4)+"-01-01", to:t };
  const days = u.range==="7d"? 7 : u.range==="90d"? 90 : 30;
  return { from:AnalyticsCore.addDays(t, -(days-1)), to:t };
}
function anGrain(range){
  const u=anUi(); if(u.grain && u.grain!=="auto") return u.grain;
  const n=AnalyticsCore.daysBetween(range.from, range.to)+1;
  return n<=31? "day" : n<=190? "week" : "month";
}
function anOpts(){ const r=anRange(); return { ...r, grain:anGrain(r), channel:anUi().channel||"all" }; }

/* ---- KPI tiles ---- */
function anTile(label, val, sub, cls){ return `<div class="kpi${cls?" "+cls:""}"><div class="label">${label}</div><div class="val">${val}</div><div class="sub">${sub||""}</div></div>`; }
function anDelta(pct, upGood){
  if(pct==null) return `<span class="an-delta">—</span>`;
  const up=pct>=0, good= upGood? up : !up;
  return `<span class="an-delta ${good?"good":"bad"}">${up?"▲":"▼"} ${Math.abs(pct).toFixed(1)}%</span>`;
}
function anKpiHTML(ctx, opts){
  const C=AnalyticsCore, k=C.kpis(ctx, { ...opts, asOf:today(), baseline:anInputs.aovBaseline });
  const r12=k.rolling12, fill=Math.min(100, r12.pct), col=AN_STATUS[r12.status]||AN_STATUS.ok;
  const vatSub = r12.status==="red"? `⚠ Red — ${C.fmtGBP(r12.headroom)} headroom` : r12.status==="amber"? `⚠ Amber — ${C.fmtGBP(r12.headroom)} headroom` : `${C.fmtGBP(r12.headroom)} headroom`;
  const cross = r12.projectedCrossing? (r12.turnover>=r12.threshold? "threshold crossed" : `crossing ≈ ${fmtDate(r12.projectedCrossing)} at ${C.fmtGBP(r12.runRatePerDay)}/day`) : "no run-rate yet";
  const gm=k.grossMargin, rr=k.repeat, ro=k.roas, bal=k.balance;
  const chan= opts.channel && opts.channel!=="all"? ` · ${AN_CHANNELS.find(c=>c[0]===opts.channel)[1].toLowerCase()}` : "";
  const ms=today().slice(0,8)+"01", bt= (opts.channel==="all"||opts.channel==="club"||!opts.channel)? anInvoiceRows().filter(r=>r.paidAt.slice(0,10)>=ms).reduce((s,r)=>s+r.grossGbp,0) : 0;
  /* Total revenue inside the selected range (the toolbar's range + channel): gross
     settled GBP net of refunds dated in the range — the same basis as the A1 chart. */
  const inRange=C.filterRows(ctx.rows, opts), refIn=C.refundsIn(ctx, opts);
  const refunded=C.sum(refIn, f=>f.amountGbp), revRange=C.round2(C.sum(inRange, r=>r.grossGbp)-refunded);
  const btRange=C.sum(inRange.filter(r=>r.source==="invoice"), r=>r.grossGbp);
  return `<div class="kpis an-kpis" style="padding:0 0 18px">
    ${anTile("Revenue · "+esc(anRangeLabel(opts)), C.fmtGBP(revRange), `${inRange.length} order${inRange.length===1?"":"s"}${refunded? ` · net of ${C.fmtGBP(refunded)} refunded`:""}${btRange? ` · incl. ${C.fmtGBP(btRange)} by bank transfer`:""}${chan}`, "accent")}
    ${anTile("Revenue month to date", C.fmtGBP(k.revenueMtd), `${anDelta(k.revenueDeltaToDate, true)} vs same point last month · last month ${C.fmtGBP(k.revenueLastMonth)}${chan}${bt? ` · incl. ${C.fmtGBP(bt)} by bank transfer`:""}`)}
    ${anTile("Orders month to date", String(k.ordersMtd), `orders placed${chan}`)}
    ${anTile("Average order value", k.aov==null? "—" : C.fmtGBP(k.aov), k.aov==null? "no orders in range" : `${anDelta(k.aovVsBaseline, true)} vs ${C.fmtGBP(k.aovBaseline)} July 2026 baseline`)}
    ${anTile("Gross margin", gm.margin==null? "—" : C.fmtPct(gm.margin), gm.uncosted? `${gm.costed} costed · ${gm.uncosted} un-costed order${gm.uncosted===1?"":"s"} (unit costs on Stock)` : gm.costed? `goods revenue − cost of goods · ${gm.costed} orders` : "set unit costs on the Stock tab")}
    ${anTile("Refund rate", k.refundRate==null? "—" : C.fmtPct(k.refundRate), `${C.fmtGBP(k.refundedRange)} refunded · ${k.refundedOrders} of ${k.ordersRange} orders in range`)}
    ${anTile("Repeat customers", rr.rate==null? "—" : C.fmtPct(rr.rate), `${rr.repeaters} of ${rr.customers} customers ordered twice+ (all time)`)}
    ${anTile("Stripe balance", an.treasury&&!an.treasury.error? C.fmtGBP(bal.available) : "—", an.treasury&&!an.treasury.error? `available · ${C.fmtGBP(bal.pending)} pending` : an.treasury&&an.treasury.error? "balance unavailable — Sync" : "Sync to read the balance")}
    <div class="kpi"><div class="label">Rolling 12-month turnover</div><div class="val">${C.fmtGBP(r12.turnover)}</div>
      <div class="an-meter" title="${C.fmtPct(r12.pct)} of the £90,000 VAT threshold"><div class="an-meter-fill" style="width:${fill.toFixed(1)}%;background:${col}"></div><span class="an-meter-mark" style="left:${(C.VAT_AMBER/r12.threshold*100).toFixed(1)}%"></span><span class="an-meter-mark" style="left:${(C.VAT_RED/r12.threshold*100).toFixed(1)}%"></span></div>
      <div class="sub">${C.fmtPct(r12.pct)} of £90k · ${vatSub} · ${cross}</div></div>
    ${anTile("Blended ROAS", ro.roas==null? "—" : ro.roas.toFixed(2)+"×", ro.spend? `${C.fmtGBP(ro.spend)} Meta spend · ${C.fmtGBP(ro.revenue)} attributed · CAC ${ro.cac==null?"—":C.fmtGBP(ro.cac)}` : "add Meta spend under Inputs")}
  </div>`;
}

/* ---- chart cards: every card has a data function → rows (its table twin + CSV);
        `draw` (SVG) is added per card by the chart build steps. ---- */
const AN_CARDS = [];   /* {id, title, note, data(ctx,opts)→{rows, cols, ...}, draw?(d, card, host)} */
function anCardHTML(card, d, full){
  const open= full? false : (an.table[card.id] || !card.draw);
  const rows=d.rows||[], cols=d.cols||(rows[0]? Object.keys(rows[0]).map(k=>({key:k,label:k})) : []);
  const empty= !rows.length;   /* a card with no table rows shows its empty text (the funnel's steps count only once GA4 is connected) */
  const table= cols.length && rows.length? `<div class="an-tablewrap"${(card.draw && !open && !full)?' style="display:none"':""} title="${full?"":"Click to open full screen"}"><table class="completed an-table"><thead><tr>${cols.map(c=>`<th${c.num?' class="num"':""}>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0,400).map(r=>`<tr>${cols.map(c=>`<td${c.num?' class="num"':""}>${esc(c.fmt? c.fmt(r[c.key], r) : (r[c.key]==null? "—" : r[c.key]))}</td>`).join("")}</tr>`).join("")}</tbody></table>${rows.length>400?`<div class="proton-spec" style="text-transform:none;padding:6px 2px">first 400 of ${rows.length} rows — the CSV has all of them</div>`:""}</div>` : "";
  return `<section class="an-card${an.syncing?" an-dim":""}" data-card="${card.id}">
    <header class="an-card-head"><div><span class="an-card-id">${card.id}</span><h3>${esc(card.title)}</h3></div><div class="an-card-ctl">${d.controls||""}${full? ` <button class="btn small an-close" title="Close full screen">×</button>` : ""}</div></header>
    ${empty? `<div class="an-empty">${esc(d.emptyText||"No orders in this range.")}</div>` : `<div class="an-plot"${(open&&!full)?' style="display:none"':""}>${card.draw? "" : `<div class="an-empty">Chart arrives with the next build step — the table below has every value.</div>`}</div>${table}`}
    <footer class="an-card-foot"><span class="proton-spec" style="text-transform:none">${esc(d.note||card.note||"")}</span><div class="spacer"></div>
      ${card.draw && rows.length && !full? `<button class="btn small an-toggle" data-card="${card.id}">${open?"Chart":"Table"}</button>`:""}
      ${!full? `<button class="btn small an-expand" data-card="${card.id}" title="Open full screen">⤢</button>`:""}
      <button class="btn small an-csv" data-card="${card.id}"${rows.length?"":" disabled"}>CSV</button></footer>
  </section>`;
}
function anCardCSV(card, d){
  const cols=(d.cols||(d.rows[0]? Object.keys(d.rows[0]).map(k=>({key:k,label:k})) : [])).map(c=>({ key:c.key, label:c.label, get:(r)=>c.raw? c.raw(r) : (r[c.key]==null? "" : r[c.key]) }));
  download(`analytics-${card.id.toLowerCase()}-${today()}.csv`, AnalyticsCore.toCSV(d.rows||[], cols), "text/csv");
}

/* ---- inputs panel ---- */
function anOpt(list, sel){ return list.map(([k,l])=>`<option value="${k}"${k===sel?" selected":""}>${esc(l)}</option>`).join(""); }
function anInputsHTML(){
  const C=AnalyticsCore;
  const prodOpts=(sel)=>wsProductOptions(sel);
  const wh=anInputs.wholesale.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const sp=anInputs.metaSpend.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const rc=anInputs.received.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="an-inputs">
    <div class="an-input-col">
      <div class="proton-eyebrow">Wholesale invoices — EBF shop at 70% of retail</div>
      <div class="stq-panel an-form" id="anWhForm">
        <input id="anWhDate" type="date" value="${today()}" title="Invoice date"> <input id="anWhRef" placeholder="Invoice ref" style="width:110px"> <input id="anWhCust" placeholder="Customer" value="Edinburgh Bike Fitting" style="width:170px"> <input id="anWhAmt" type="number" min="0" step="0.01" placeholder="£ total" style="width:90px">
        <div id="anWhLines" class="an-lines"></div>
        <button class="btn small" id="anWhAddLine">Add line</button> <button class="btn small primary" id="anWhSave">Add invoice</button>
      </div>
      ${wh.length? `<table class="completed an-table"><thead><tr><th>Date</th><th>Ref</th><th>Customer</th><th>Lines</th><th class="num">£</th><th></th></tr></thead><tbody>${wh.map(w=>`<tr><td>${fmtDate(w.date)}</td><td>${esc(w.ref)}</td><td>${esc(w.customer)}</td><td style="white-space:normal">${esc(w.lines.map(l=>`${HANDLE_NAME[l.handle]||l.handle} ${l.size} ×${l.qty}`).join(", "))}</td><td class="num">${C.fmtGBP(w.amount)}</td><td><button class="btn small an-del" data-kind="wholesale" data-id="${esc(w.id)}">×</button></td></tr>`).join("")}</tbody></table>` : `<div class="proton-spec" style="text-transform:none">No wholesale invoices yet — units sold here count toward sell-through and turnover.</div>`}
      <div class="proton-eyebrow" style="margin-top:18px">Stock received — batches from the factory (sell-through = sold ÷ received)</div>
      <div class="stq-panel an-form">
        <select id="anRcProd" style="min-width:200px">${prodOpts("")}</select> <select id="anRcSize"></select> <input id="anRcQty" type="number" min="1" step="1" value="10" style="width:70px" title="Units"> <input id="anRcDate" type="date" value="${today()}"> <input id="anRcCost" type="number" min="0" step="0.01" placeholder="£ unit cost" style="width:100px"> <button class="btn small primary" id="anRcSave">Add batch</button>
      </div>
      ${rc.length? `<table class="completed an-table"><thead><tr><th>Date</th><th>Product</th><th>Size</th><th class="num">Units</th><th class="num">Unit cost</th><th></th></tr></thead><tbody>${rc.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(HANDLE_NAME[r.handle]||r.handle)}</td><td>${esc(r.size)}</td><td class="num">${r.qty}</td><td class="num">${r.unitCost!=null?C.fmtGBP(r.unitCost):"—"}</td><td><button class="btn small an-del" data-kind="received" data-id="${esc(r.id)}">×</button></td></tr>`).join("")}</tbody></table>` : `<div class="proton-spec" style="text-transform:none">No batches recorded — until then received is implied as sold + on hand.</div>`}
    </div>
    <div class="an-input-col">
      <div class="proton-eyebrow">Meta ad spend — daily, or import the Ads Manager export (Day + Amount spent)</div>
      <div class="stq-panel an-form">
        <input id="anSpDate" type="date" value="${today()}"> <input id="anSpAmt" type="number" min="0" step="0.01" placeholder="£ spent" style="width:100px"> <button class="btn small primary" id="anSpSave">Add day</button>
        <label class="btn small" for="anSpFile" style="cursor:pointer">Import CSV</label><input id="anSpFile" type="file" accept=".csv,text/csv" style="display:none">
      </div>
      ${sp.length? `<div class="proton-spec" style="text-transform:none;padding:0 0 6px">${sp.length} day${sp.length===1?"":"s"} · ${C.fmtGBP(C.sum(sp,s=>s.spend))} total</div><table class="completed an-table"><thead><tr><th>Day</th><th class="num">£ spent</th><th></th></tr></thead><tbody>${sp.slice(0,60).map(s=>`<tr><td>${fmtDate(s.date)}</td><td class="num">${C.fmtGBP(s.spend)}</td><td><button class="btn small an-del" data-kind="metaSpend" data-id="${esc(s.date)}">×</button></td></tr>`).join("")}</tbody></table>` : `<div class="proton-spec" style="text-transform:none">No spend recorded — ROAS and CAC stay blank until it is.</div>`}
      <div class="proton-eyebrow" style="margin-top:18px">Targets</div>
      <div class="stq-panel an-form">
        <label class="proton-spec" style="text-transform:none">Cumulative revenue target (£) <input id="anTarget" type="number" min="0" step="1" value="${anInputs.targets.cumulative||""}" style="width:110px"></label>
        <label class="proton-spec" style="text-transform:none">AOV baseline (£) <input id="anAov" type="number" min="0" step="0.01" value="${anInputs.aovBaseline}" style="width:90px"></label>
        <button class="btn small primary" id="anTgSave">Save</button>
      </div>
      <div class="proton-eyebrow" style="margin-top:18px">Cache</div>
      <div class="proton-spec" style="text-transform:none">${an.rows? `${an.rows.length} Stripe orders cached since ${AN_START}` : "nothing cached yet"}${anInputs.lastSync?` · last sync ${anInputs.lastSync.slice(0,16).replace("T"," ")}`:""}. <button class="btn small" id="anFull" title="Clear the cache and rebuild it from Stripe">Full resync</button></div>
    </div>
  </div>`;
}
let anWhLines=[];
function anWireInputs(wrap){
  const C=AnalyticsCore;
  const paintLines=()=>{ const box=wrap.querySelector("#anWhLines"); if(!box) return;
    box.innerHTML=anWhLines.map((l,i)=>`<div class="wline"><select class="wl-prod an-wl-prod" data-i="${i}">${wsProductOptions(l.handle)}</select><select class="wl-size an-wl-size" data-i="${i}">${sizesFor(l.handle).map(s=>`<option${s===l.size?" selected":""}>${s}</option>`).join("")}</select><input class="wl-qty an-wl-qty" data-i="${i}" type="number" min="1" value="${l.qty}" style="width:60px"><button class="btn small an-wl-del" data-i="${i}">×</button></div>`).join("");
    box.querySelectorAll(".an-wl-prod").forEach(s=>s.onchange=()=>{ const l=anWhLines[+s.dataset.i]; l.handle=s.value; l.size=sizesFor(l.handle)[0]; paintLines(); });
    box.querySelectorAll(".an-wl-size").forEach(s=>s.onchange=()=>{ anWhLines[+s.dataset.i].size=s.value; });
    box.querySelectorAll(".an-wl-qty").forEach(s=>s.oninput=()=>{ anWhLines[+s.dataset.i].qty=Math.max(1,Math.floor(+s.value||1)); });
    box.querySelectorAll(".an-wl-del").forEach(b=>b.onclick=()=>{ anWhLines.splice(+b.dataset.i,1); paintLines(); });
  };
  paintLines();
  const q=(id)=>wrap.querySelector("#"+id);
  if(q("anWhAddLine")) q("anWhAddLine").onclick=()=>{ const first=CATALOG[0].items[0]; anWhLines.push({ handle:first[2], size:sizesFor(first[2])[0], qty:1 }); paintLines(); };
  if(q("anWhSave")) q("anWhSave").onclick=()=>{ const date=q("anWhDate").value, amount=+q("anWhAmt").value||0; if(!date||!amount){ alert("An invoice needs a date and a total."); return; }
    anInputs.wholesale.push({ id:"w"+uid(), date, ref:q("anWhRef").value.trim(), customer:q("anWhCust").value.trim(), amount:+amount.toFixed(2), lines:anWhLines.map(l=>({...l})) }); anWhLines=[]; anSaveInputs(); renderAnalytics(); };
  const rcProd=q("anRcProd"), rcSize=q("anRcSize");
  const fillSizes=()=>{ if(rcSize) rcSize.innerHTML=stockSizesFor(rcProd.value).map(s=>`<option>${s}</option>`).join(""); };
  if(rcProd){ rcProd.onchange=fillSizes; fillSizes(); }
  if(q("anRcSave")) q("anRcSave").onclick=()=>{ const handle=rcProd.value, qty=Math.floor(+q("anRcQty").value||0), date=q("anRcDate").value; if(!handle||!qty||!date){ alert("A batch needs a product, units and a date."); return; }
    const uc=q("anRcCost").value.trim(); anInputs.received.push({ id:"r"+uid(), handle, size:rcSize.value, qty, date, unitCost: uc===""? null : +(+uc).toFixed(2) });
    if(uc!=="" && retailCosts.unitCost[handle]==null){ retailCosts.unitCost[handle]=+(+uc).toFixed(2); rcSave(); }   /* first cost seen seeds the Stock tab's unit cost */
    anSaveInputs(); renderAnalytics(); };
  if(q("anSpSave")) q("anSpSave").onclick=()=>{ const date=q("anSpDate").value, spend=+q("anSpAmt").value; if(!date||!(spend>=0)){ alert("Spend needs a day and an amount."); return; }
    anInputs.metaSpend=anInputs.metaSpend.filter(s=>s.date!==date).concat([{ date, spend:+spend.toFixed(2) }]); anSaveInputs(); renderAnalytics(); };
  if(q("anSpFile")) q("anSpFile").onchange=(e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const n=anImportSpendCSV(String(r.result||"")); alert(n? `Imported ${n} day${n===1?"":"s"} of spend.` : "Couldn't find a Day column and an Amount spent column in that file."); renderAnalytics(); }; r.readAsText(f); e.target.value=""; };
  if(q("anTgSave")) q("anTgSave").onclick=()=>{ anInputs.targets.cumulative=+q("anTarget").value||0; anInputs.aovBaseline=+q("anAov").value||135; anSaveInputs(); renderAnalytics(); };
  if(q("anFull")) q("anFull").onclick=()=>{ if(confirm("Clear the local analytics cache and rebuild it from Stripe? Your inputs (wholesale, spend, batches, targets) are kept.")) anSync({ full:true }); };
  wrap.querySelectorAll(".an-del").forEach(b=>b.onclick=()=>{ const k=b.dataset.kind, id=b.dataset.id;
    if(k==="wholesale") anInputs.wholesale=anInputs.wholesale.filter(w=>w.id!==id);
    else if(k==="received") anInputs.received=anInputs.received.filter(r=>r.id!==id);
    else if(k==="metaSpend") anInputs.metaSpend=anInputs.metaSpend.filter(s=>s.date!==id);
    anSaveInputs(); renderAnalytics(); });
}
/* Meta Ads Manager export: a Day column (YYYY-MM-DD) + an "Amount spent" column; other columns ignored. */
function anImportSpendCSV(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) return 0;
  const split=(l)=>{ const out=[]; let cur="", q=false; for(const ch of l){ if(ch==='"'){ q=!q; continue; } if(ch===","&&!q){ out.push(cur); cur=""; continue; } cur+=ch; } out.push(cur); return out.map(s=>s.trim()); };
  const head=split(lines[0]).map(h=>h.toLowerCase());
  const di=head.findIndex(h=>h==="day"||h==="date"||h.startsWith("reporting starts")), ai=head.findIndex(h=>h.startsWith("amount spent")||h==="spend"||h==="cost");
  if(di<0||ai<0) return 0;
  const byDay=new Map(anInputs.metaSpend.map(s=>[s.date,s.spend])); let n=0;
  for(const l of lines.slice(1)){ const c=split(l); const d=(c[di]||"").slice(0,10); const v=+String(c[ai]||"").replace(/[^0-9.\-]/g,""); if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(v)) continue; byDay.set(d, +v.toFixed(2)); n++; }
  anInputs.metaSpend=[...byDay.entries()].map(([date,spend])=>({date,spend})); anSaveInputs(); return n;
}

/* ---- the tab ---- */
function anPaintStatus(){ const el=document.getElementById("anStatus"); if(el) el.innerHTML=anStatusHTML(); }
function anStatusHTML(){
  const bits=[];
  if(an.syncing) bits.push(`<span class="an-spin">↻</span> ${esc(an.status||"Syncing…")}`);
  else if(an.error) bits.push(`<span style="color:var(--signal)">${esc(an.error)}</span>`);
  else if(anInputs.lastSync) bits.push(`synced ${anInputs.lastSync.slice(0,16).replace("T"," ")} · ${(an.rows||[]).length} Stripe orders since ${AN_START}`);
  else bits.push("not synced yet — press Sync");
  const inv=anInvoiceRows(), outst=orders.filter(invoiceOutstanding).reduce((s,o)=>s+invoiceAmountOf(o),0), unk=orders.filter(o=>o.stage==="delivered" && !o.paidVia && revenueOf(o)>0).length;
  bits.push(`${inv.length} bank-transfer invoice${inv.length===1?"":"s"} (${AnalyticsCore.fmtGBP(inv.reduce((s,r)=>s+r.grossGbp,0))}) included${outst? ` · ${AnalyticsCore.fmtGBP(outst)} invoiced, outstanding`:""}${unk? ` · <span style="color:#C47F00">${unk} completed order${unk===1?"":"s"} without a payment method</span>`:""} · <a href="#" onclick="openPayCheck();return false">Payment check</a>`);
  const shopBt=(an.rows||[]).filter(r=>r.paymentMethod===AN_BANK_PM), shopAw=shopBt.filter(r=>r.unpaid);
  if(shopBt.length) bits.push(`${shopBt.length} bank-transfer shop order${shopBt.length===1?"":"s"} counted from the order date${shopAw.length? ` · ${AnalyticsCore.fmtGBP(shopAw.reduce((s,r)=>s+r.grossGbp,0))} of it awaiting payment (${shopAw.length})`:""}`);
  if(an.funnel){ bits.push(an.funnel.error==="GA4_NOT_CONFIGURED"? "GA4 funnel: not connected (see the funnel card)" : an.funnel.error? "GA4: "+esc(an.funnel.error) : `GA4: ${an.funnel.days.length} day${an.funnel.days.length===1?"":"s"}`); }
  return bits.join(" · ");
}
function anOpenWindow(){ window.open(location.href.split("#")[0]+"#view=analytics&solo=1","_blank"); }
/* Toolbar state → DOM, without rebuilding it (keeps focus in the date inputs). */
function anSyncToolbar(tb, u, opts){
  tb.querySelectorAll("#anRangeSeg button").forEach(b=>b.classList.toggle("active", b.dataset.range===u.range));
  tb.querySelectorAll("#anChanSeg button").forEach(b=>b.classList.toggle("active", b.dataset.chan===(u.channel||"all")));
  tb.querySelectorAll("#anGrainSeg button").forEach(b=>b.classList.toggle("active", b.dataset.grain===(u.grain||"auto")));
  const c=tb.querySelector("#anCustom"); if(c) c.style.display= u.range==="custom"? "" : "none";
  const f=tb.querySelector("#anFrom"), t=tb.querySelector("#anTo");
  if(f && document.activeElement!==f) f.value=u.from||opts.from;
  if(t && document.activeElement!==t) t.value=u.to||opts.to;
  const ib=tb.querySelector("#anInputsBtn"); if(ib) ib.textContent= an.inputsOpen? "Hide inputs" : "Inputs";
  const sb=tb.querySelector("#anSync"); if(sb) sb.disabled=!!an.syncing;
  anPaintStatus();
}
/* "last 30 days" / "year to date" / "03-10-2026 – 01-11-2026" for the range tile. */
function anRangeLabel(opts){
  const u=anUi();
  if(u.range==="custom") return `${fmtDate(opts.from)} – ${fmtDate(opts.to)}`;
  const r=AN_RANGES.find(x=>x[0]===u.range); return r? r[1].toLowerCase() : "selected range";
}
async function renderAnalytics(){
  const wrap=document.getElementById("analyticsView"); if(!wrap) return;
  if(!an.loaded){ await anLoadCache(); if(!an.rows.length && !an.syncing && !an.error && localStorage.getItem(WS_KEY_STORE) && wsBackendCan("analytics")) anSync(); }
  if(localStorage.getItem(WS_KEY_STORE)){
    /* club roster (handles for club unit costs + windows) and stock rows (sell-through) — both live elsewhere */
    if(!an.rosterTried){ an.rosterTried=true; try{ await csReady(); }catch(e){} }
    if(typeof stockState!=="undefined" && stockState && !stockState.rows && !stockState.loading && !stockState.error) stockLoad();
  }
  const u=anUi(), opts=anOpts(), ctx=anCtx();
  /* The toolbar is built once and then updated in place (anSyncToolbar):
     rebuilding it on every filter change destroyed the custom-range date
     inputs mid-edit — typing a year fires change after each digit (2026-11-01). */
  let tb=wrap.querySelector("#anToolbar"), body=wrap.querySelector("#anBody");
  const toolbar=`
    <div class="toolbar an-toolbar" style="padding:0 0 10px">
      <span class="proton-eyebrow">Analytics · Stripe-accurate, both streams</span>
      <div class="seg" id="anRangeSeg">${AN_RANGES.map(([k,l])=>`<button data-range="${k}"${u.range===k?' class="active"':""}>${l}</button>`).join("")}</div>
      <span id="anCustom" style="${u.range==="custom"?"":"display:none"}"><input type="date" id="anFrom" min="2020-01-01" max="2100-12-31" value="${esc(u.from||opts.from)}"> – <input type="date" id="anTo" min="2020-01-01" max="2100-12-31" value="${esc(u.to||opts.to)}"></span>
      <div class="seg" id="anChanSeg">${AN_CHANNELS.map(([k,l])=>`<button data-chan="${k}"${(u.channel||"all")===k?' class="active"':""}>${l}</button>`).join("")}</div>
      <div class="seg" id="anGrainSeg">${AN_GRAINS.map(([k,l])=>`<button data-grain="${k}"${(u.grain||"auto")===k?' class="active"':""}>${l}</button>`).join("")}</div>
      <div class="spacer"></div>
      <button class="btn small" id="anInputsBtn">${an.inputsOpen?"Hide inputs":"Inputs"}</button>
      <button class="btn small primary" id="anSync"${an.syncing?" disabled":""}>↻ Sync</button>
      <button class="btn small" id="anNewWin" title="Open Analytics alone in a new window">↗ New window</button>
    </div>
    <div class="proton-spec an-status" id="anStatus" style="text-transform:none;padding:0 0 14px">${anStatusHTML()}</div>`;
  const gate = !wsBackendCan("analytics") && ws.data? `<div class="empty">The live backend doesn't have the analytics endpoint yet — merge the <code>analytics</code> branch, wait for the deploy to finish, then press Sync. Manual and wholesale orders are shown meanwhile.</div>` : "";
  const cards=AN_CARDS.map(card=>{ let d; try{ d=card.data(ctx, opts); }catch(e){ console.error("analytics card", card.id, e); d={ rows:[], emptyText:"This card hit an error: "+e.message }; } return anCardHTML(card, d); }).join("");
  const fullCard= an.full? AN_CARDS.find(c=>c.id===an.full) : null;
  let fullData=null; if(fullCard){ try{ fullData=fullCard.data(ctx, opts); }catch(e){ fullData={ rows:[], emptyText:"This card hit an error: "+e.message }; } }
  if(!tb || !body){
    wrap.innerHTML=`<div id="anToolbar"></div><div id="anBody"></div>`;
    tb=wrap.querySelector("#anToolbar"); body=wrap.querySelector("#anBody");
    tb.innerHTML=toolbar;
    /* toolbar wiring — once; handlers read the live ui state, never a stale copy */
    tb.querySelectorAll("#anRangeSeg button").forEach(b=>b.onclick=()=>{ const uu=anUi(); uu.range=b.dataset.range; if(uu.range==="custom"&&!uu.from){ const r=anRange(); uu.from=r.from; uu.to=r.to; } uiSave(); renderAnalytics(); });
    tb.querySelectorAll("#anChanSeg button").forEach(b=>b.onclick=()=>{ anUi().channel=b.dataset.chan; uiSave(); renderAnalytics(); });
    tb.querySelectorAll("#anGrainSeg button").forEach(b=>b.onclick=()=>{ anUi().grain=b.dataset.grain; uiSave(); renderAnalytics(); });
    /* a date commits only once its year is real (typing "2026" passes through 0002 → 0020 → 0202) */
    const commitDate=(which, el)=>{ const v=el.value, y=+v.slice(0,4); if(!v || y<2000 || y>2100) return; const uu=anUi(); if(uu[which]===v && uu.range==="custom") return; uu[which]=v; uu.range="custom"; uiSave(); renderAnalytics(); };
    const f=tb.querySelector("#anFrom"), t=tb.querySelector("#anTo");
    f.onchange=()=>commitDate("from", f); t.onchange=()=>commitDate("to", t);
    tb.querySelector("#anSync").onclick=()=>anSync();
    tb.querySelector("#anNewWin").onclick=anOpenWindow;
    tb.querySelector("#anInputsBtn").onclick=()=>{ an.inputsOpen=!an.inputsOpen; renderAnalytics(); };
  }
  anSyncToolbar(tb, u, opts);
  body.innerHTML = (an.inputsOpen? anInputsHTML() : "") + gate + anKpiHTML(ctx, opts) +
    `<div class="an-grid${an.syncing?" an-dim":""}" id="anGrid">${cards}</div>` + anPlannedHTML() +
    (fullCard? `<div class="an-full" id="anFull">${anCardHTML(fullCard, fullData, true)}</div>` : "");
  document.body.style.overflow = fullCard? "hidden" : "";
  /* body wiring */
  if(an.inputsOpen) anWireInputs(wrap);
  wrap.querySelectorAll(".an-toggle").forEach(b=>b.onclick=()=>{ an.table[b.dataset.card]=!an.table[b.dataset.card]; renderAnalytics(); });   /* chart ⇄ table twin */
  wrap.querySelectorAll(".an-csv").forEach(b=>b.onclick=()=>{ const card=AN_CARDS.find(c=>c.id===b.dataset.card); if(card) anCardCSV(card, card.data(ctx, opts)); });
  /* full screen: ⤢ or a click on a card's table; × closes */
  wrap.querySelectorAll(".an-expand").forEach(b=>b.onclick=()=>{ an.full=b.dataset.card; renderAnalytics(); });
  wrap.querySelectorAll("#anGrid .an-tablewrap").forEach(t=>t.addEventListener("click",(e)=>{ if(e.target.closest("button,a,input,select")) return; an.full=t.closest(".an-card").dataset.card; renderAnalytics(); }));
  const closeBtn=wrap.querySelector("#anFull .an-close"); if(closeBtn) closeBtn.onclick=()=>{ an.full=null; renderAnalytics(); };
  const grid=wrap.querySelector("#anGrid");
  AN_CARDS.forEach(card=>{ if(!card.draw) return; const host=grid.querySelector(`.an-card[data-card="${card.id}"] .an-plot`); if(!host || host.style.display==="none") return; try{ card.draw(card.data(ctx, opts), card, host, ctx, opts); }catch(e){ console.error("analytics draw", card.id, e); host.innerHTML=`<div class="an-empty">Chart error: ${esc(e.message)}</div>`; } });
  anWireCards(grid, ctx, opts);
  if(fullCard){ const fh=wrap.querySelector("#anFull .an-plot"); if(fh && fullCard.draw){ try{ fullCard.draw(fullData, fullCard, fh, ctx, opts); }catch(e){ fh.innerHTML=`<div class="an-empty">Chart error: ${esc(e.message)}</div>`; } } if(fullCard.wire) fullCard.wire(wrap.querySelector("#anFull .an-card"), ctx, opts); }
}
function anWireCards(wrap, ctx, opts){ AN_CARDS.forEach(card=>{ if(card.wire) card.wire(wrap.querySelector(`.an-card[data-card="${card.id}"]`), ctx, opts); }); }

/* ---- Phase 2 — planned, not built ---- */
const AN_PLANNED = ["Units-per-order histogram","Day-of-week × hour revenue heatmap","Drop-on-drop comparison (indexed to launch day)","Net revenue waterfall (gross → discounts → refunds → fees → shipping → net)","Weeks-of-stock table per SKU","Size curve: ordered vs sold","Product affinity (bought together)","Price realisation per SKU","Cohort retention triangle","Customer LTV distribution + top customers","Time between first and second purchase","Club-shop penetration (orders ÷ club size)","Promo code performance","Email list → purchase conversion (women's kit list)","Revenue timeline with event annotations","Cart abandonment rate and value","Payment method mix and success rate","Failed / declined payments by reason","Order-to-dispatch and order-to-delivery times","Shipping charged vs shipping cost","Stripe fee % of revenue","Currency mix and FX impact","Club shop margin (revenue vs manufacturing cost)","Sponsored-kit discount value per team"];
function anPlannedHTML(){ return `<div class="proton-eyebrow" style="margin:26px 0 10px">Planned — phase 2, not built yet</div><div class="an-planned">${AN_PLANNED.map(t=>`<div class="an-planned-card" aria-disabled="true"><span>${esc(t)}</span><span class="tag">planned</span></div>`).join("")}</div>`; }

/* ---- cards: data functions (tables + CSV now; SVG renderers added by the chart build steps) ---- */
(function(){
  const C=AnalyticsCore, M=(v)=>v==null?"—":C.fmtGBP(v), P=(v)=>v==null?"—":C.fmtPct(v);
  const bucketCol=(grain)=>({ key:"bucket", label: grain==="month"? "Month" : grain==="week"? "Week commencing" : "Day" });
  AN_CARDS.push({ id:"A1", title:"Revenue over time by channel", note:"Settled GBP, net of refunds in the period they were refunded. Retail · Club shop · Wholesale · Unattributed. Club shop includes club invoices paid by bank transfer (Payment check).",
    data:(ctx,o)=>{ const r=C.revenueByChannel(ctx,o); return { ...r, cols:[bucketCol(o.grain),{key:"retail",label:"Retail",num:true,fmt:M},{key:"club",label:"Club shop",num:true,fmt:M},{key:"wholesale",label:"Wholesale",num:true,fmt:M},{key:"unattributed",label:"Unattributed",num:true,fmt:M},{key:"total",label:"Total",num:true,fmt:M}] }; } });
  AN_CARDS.push({ id:"A2", title:"Orders vs revenue", note:"Two aligned panels on one time axis (no dual y-axis): paid orders, and revenue net of refunds.",
    data:(ctx,o)=>{ const r=C.ordersVsRevenue(ctx,o); return { ...r, cols:[bucketCol(o.grain),{key:"orders",label:"Orders",num:true},{key:"revenue",label:"Revenue",num:true,fmt:M}] }; } });
  AN_CARDS.push({ id:"A3", title:"Average order value", note:"AOV per period with a 30-day rolling mean; flagged against the July 2026 baseline (Inputs → AOV baseline).",
    data:(ctx,o)=>{ const r=C.aovSeries(ctx,{...o, baseline:anInputs.aovBaseline}); return { ...r, cols:[bucketCol(o.grain),{key:"orders",label:"Orders",num:true},{key:"aov",label:"AOV",num:true,fmt:M},{key:"rolling",label:"30-day rolling",num:true,fmt:M}], note:`Current AOV ${M(r.current)} · baseline ${M(r.baseline)}${r.vsBaseline!=null?` · ${r.vsBaseline>=0?"+":""}${r.vsBaseline.toFixed(1)}% vs baseline`:""}.` }; } });
  AN_CARDS.push({ id:"A6", title:"Cumulative revenue vs target", note:"Running total over the range, net of refunds, against the target from Inputs.",
    data:(ctx,o)=>{ const r=C.cumulativeRevenue(ctx,{...o, target:anInputs.targets.cumulative}); return { ...r, cols:[{key:"bucket",label:"Day"},{key:"revenue",label:"Revenue",num:true,fmt:M},{key:"cumulative",label:"Cumulative",num:true,fmt:M},{key:"target",label:"Target",num:true,fmt:M}], note:`${M(r.total)} so far${r.target?` of ${M(r.target)} target (${P(r.total/r.target*100)})`:" — set a target under Inputs"}.` }; } });
  AN_CARDS.push({ id:"B9", title:"Revenue & units by product", note:"Click a bar to drill product → colourway → size. Line money is Stripe's per-line amount after discounts.",
    data:(ctx,o)=>{ const r=C.bySku(ctx,{...o, level:an.b9.level, parent:an.b9.parent, metric:an.b9.metric}); const crumbs=an.b9.level==="product"?"All products":an.b9.level==="colourway"?an.b9.parent:an.b9.parent.replace("|"," · ");
      return { ...r, cols:[{key:"label",label:an.b9.level==="product"?"Product":an.b9.level==="colourway"?"Colourway":"Size"},{key:"units",label:"Units",num:true},{key:"revenue",label:"Revenue",num:true,fmt:M},{key:"orders",label:"Orders",num:true}],
        controls:`<span class="proton-spec" style="text-transform:none;margin-right:8px">${esc(crumbs)}</span>${an.b9.level!=="product"?`<button class="btn small an-b9-up">← Back</button> `:""}<div class="seg"><button class="an-b9-m${an.b9.metric==="units"?" active":""}" data-m="units">Units</button><button class="an-b9-m${an.b9.metric==="revenue"?" active":""}" data-m="revenue">£</button></div>` }; },
    wire:(el)=>{ if(!el) return; el.querySelectorAll(".an-b9-m").forEach(b=>b.onclick=()=>{ an.b9.metric=b.dataset.m; renderAnalytics(); }); const up=el.querySelector(".an-b9-up"); if(up) up.onclick=()=>{ if(an.b9.level==="size"){ an.b9.level="colourway"; an.b9.parent=an.b9.parent.split("|").slice(0,1).join("|"); } else { an.b9.level="product"; an.b9.parent=null; } renderAnalytics(); }; } });
  AN_CARDS.push({ id:"B10", title:"Sell-through per product", note:"Units sold (retail + wholesale, all time) ÷ units received; weeks of cover at the trailing-4-week rate — under 4 weeks red, under 8 amber. Club kit is made to order and excluded.",
    data:(ctx,o)=>{ const r=C.sellThrough(ctx,{asOf:ctx.asOf}); const st={red:"⚠ under 4 wks",amber:"⚠ under 8 wks",ok:"ok",static:"no recent sales",out:"sold out"};
      return { rows:r.rows.map(x=>({ ...x, statusLabel:st[x.status]||x.status })), cols:[{key:"name",label:"Product"},{key:"sold",label:"Sold",num:true},{key:"received",label:"Received",num:true,fmt:(v,r)=>r.implied? v+" (implied)" : v},{key:"stock",label:"On hand",num:true},{key:"sellThrough",label:"Sell-through",num:true,fmt:P},{key:"weeklyRate",label:"Units / wk",num:true},{key:"weeksOfCover",label:"Weeks of cover",num:true,fmt:(v)=>v==null?"—":v},{key:"statusLabel",label:"Status"}], emptyText:"No stock-held sales yet." }; } });
  AN_CARDS.push({ id:"C15", title:"New vs returning customers", note:"Returning = an email (or phone) with an earlier paid order, any channel. Wholesale has no customer key.",
    data:(ctx,o)=>{ const r=C.newVsReturning(ctx,{...o, grain: o.grain==="day"? "week" : o.grain}); return { ...r, cols:[bucketCol(o.grain==="day"?"week":o.grain),{key:"new",label:"New",num:true},{key:"returning",label:"Returning",num:true},{key:"unknown",label:"No customer key",num:true}] }; } });
  AN_CARDS.push({ id:"C19", title:"Orders by country and UK postcode area", note:"From the delivery address (the corrected one when an order was edited), else the billing country.",
    data:(ctx,o)=>{ const r=C.geo(ctx,o); return { ...r, rows:r.countries.map(x=>({ ...x, kind:"country", label:x.country })).concat(r.ukAreas.map(x=>({ ...x, kind:"UK area", label:x.area }))), cols:[{key:"kind",label:"Level"},{key:"label",label:"Country / area"},{key:"orders",label:"Orders",num:true},{key:"revenue",label:"Revenue",num:true,fmt:M}] }; } });
  AN_CARDS.push({ id:"D21", title:"Revenue by attribution source", note:"utm_source of the visit that led to checkout. Direct = attribution captured, no campaign. Unattributed = orders placed before attribution capture went live. Meta click (proxy) = an fbclid cookie without UTMs.",
    data:(ctx,o)=>{ const r=C.attribution(ctx,{...o, grain:o.grain==="day"?"week":o.grain}); return { ...r, cols:[bucketCol(o.grain==="day"?"week":o.grain)].concat(r.sources.map(s=>({ key:s, label:r.sourceLabel[s], num:true, fmt:M }))) }; } });
  AN_CARDS.push({ id:"D22", title:"Meta spend vs attributed revenue", note:"Attributed = utm_source facebook / instagram / ig / fb. ROAS = attributed revenue ÷ spend; CAC = spend ÷ new customers among attributed orders. Spend comes from Inputs.",
    data:(ctx,o)=>{ const r=C.roas(ctx,o); return { ...r, cols:[bucketCol(o.grain),{key:"spend",label:"Spend",num:true,fmt:M},{key:"revenue",label:"Attributed revenue",num:true,fmt:M},{key:"roas",label:"ROAS",num:true,fmt:(v)=>v==null?"—":v.toFixed(2)+"×"}], note:`Spend ${M(r.totals.spend)} · attributed ${M(r.totals.revenue)} · ROAS ${r.totals.roas==null?"—":r.totals.roas.toFixed(2)+"×"} · CAC ${M(r.totals.cac)} (${r.totals.newCustomers} new)${r.totals.proxyRevenue?` · ${M(r.totals.proxyRevenue)} more from Meta-click proxy orders`:""}.`, emptyText: ctx.spend.length? "No orders in this range." : "No Meta spend recorded — add days under Inputs (or import the Ads Manager CSV)." }; } });
  AN_CARDS.push({ id:"E26", title:"Checkout funnel", note:"GA4 users per step (page_view → view_item → add_to_cart → begin_checkout); the purchase step is Stripe's paid-order count, which is exact. GA4 data lands 24–48 h late and is site-wide (the channel filter does not apply).",
    data:(ctx,o)=>{ const r=C.funnel(ctx,o); const notReady = !r.configured; return { ...r, rows: notReady? [] : r.rows, cols:[{key:"step",label:"Step"},{key:"users",label:"Users",num:true},{key:"pctOfFirst",label:"% of page views",num:true,fmt:P},{key:"pctOfPrev",label:"% of previous step",num:true,fmt:P}],
        emptyText: notReady? (an.funnel&&an.funnel.error==="GA4_NOT_CONFIGURED"? `GA4 is not connected yet. One-time setup: 1) enable the Google Analytics Data API in the service account's Google Cloud project; 2) GA4 Admin → Property access management → add ${an.funnel.serviceAccount||"the service account email"} as Viewer; 3) put the NUMERIC property id in Vercel as GA4_PROPERTY_ID, redeploy, then Sync.` : "Sync to load the GA4 funnel.") : "No GA4 days in this range." }; } });
  AN_CARDS.push({ id:"F30", title:"Refunds & disputes", note:"Refunds by the date they were issued; lost disputes count, inquiries (warning_*) don't. Amounts are allocated across the order's lines pro-rata for the per-product view.",
    data:(ctx,o)=>{ const r=C.refundsBySku(ctx,o); return { ...r, rows:r.table, cols:[{key:"date",label:"Date"},{key:"type",label:"Type"},{key:"amount",label:"Amount",num:true,fmt:M},{key:"reason",label:"Reason"},{key:"status",label:"Status"},{key:"items",label:"Items"},{key:"customer",label:"Customer"},{key:"paymentIntent",label:"Payment"}], note:`${r.totals.refunds} refund${r.totals.refunds===1?"":"s"} · ${r.totals.disputes} dispute${r.totals.disputes===1?"":"s"} · ${M(r.totals.amount)} in the range. By product: ${r.bySku.slice(0,4).map(x=>`${x.label} ${M(x.amount)}`).join(", ")||"—"}. By size: ${r.bySize.slice(0,4).map(x=>`${x.size} ${M(x.amount)}`).join(", ")||"—"}.`, emptyText:"No refunds or disputes in this range." }; } });
  AN_CARDS.push({ id:"F33", title:"Stripe payouts & balance", note:"Payouts by the day they land in the bank; available and pending balance as of the last sync.",
    data:(ctx,o)=>{ const r=C.payoutsSeries(ctx,{...o, grain:o.grain==="day"?"week":o.grain}); return { ...r, cols:[{key:"arrivalDate",label:"Arrives"},{key:"amount",label:"Amount",num:true,fmt:M},{key:"status",label:"Status"},{key:"id",label:"Payout"}], note:`Available ${M(r.balance.available)} · pending ${M(r.balance.pending)} · ${M(C.sum(r.paid))} paid out in the range.`, emptyText: an.treasury? "No payouts in this range." : "Sync to read payouts and the balance." }; } });
  AN_CARDS.push({ id:"F35", title:"Rolling 12-month turnover vs £90k VAT threshold", note:"Gross taxable turnover: everything customers paid incl. shipping, every channel, less refunds — never Stripe net. Projection uses the trailing-90-day run-rate.",
    data:(ctx,o)=>{ const r=C.rolling12(ctx,{asOf:ctx.asOf}); return { ...r, cols:[{key:"asOf",label:"As of"},{key:"turnover",label:"Trailing 12-month turnover",num:true,fmt:M},{key:"threshold",label:"Threshold",num:true,fmt:M}], note:`${M(r.turnover)} today (${P(r.pct)} of £90k) · ${r.projectedCrossing? (r.turnover>=r.threshold? "threshold crossed — register for VAT" : `projected crossing ≈ ${fmtDate(r.projectedCrossing)} at ${M(r.runRatePerDay)}/day`) : "no run-rate yet"}.` }; } });
  AN_CARDS.push({ id:"G37", title:"Club shops — current windows", note:"One card per club: orders over its ordering window (from the Club Shops tab), units by product and size, value ex shipping, days to deadline.",
    data:(ctx,o)=>{ const cards=C.clubCards(ctx,{asOf:ctx.asOf}); return { cards, rows:cards.map(c=>({ club:c.club, window:c.window? `${fmtDate(c.window.start)} – ${fmtDate(c.window.end)}` : "no window", orders:c.orders, units:c.units, value:c.value, daysLeft:c.daysLeft, products:c.byProduct.map(p=>`${p.name} ×${p.units}`).join(", ") })), cols:[{key:"club",label:"Club"},{key:"window",label:"Window"},{key:"orders",label:"Orders",num:true},{key:"units",label:"Units",num:true},{key:"value",label:"Value ex shipping",num:true,fmt:M},{key:"daysLeft",label:"Days to deadline",num:true,fmt:(v)=>v==null?"—":v},{key:"products",label:"Units by product"}], emptyText:"No club-shop orders synced yet." }; } });
})();

/* ---- SVG chart helpers (dataviz method: thin marks, 2px surface gaps, hairline
        recessive grid, legend for ≥2 series, selective direct labels, crosshair
        tooltip listing every series, table twin on every card) ---- */
const AN_INK = { strong:"#0A0A0A", body:"#1A1A1A", muted:"#6E6E6E", grid:"#ECEBE5", axis:"#C9C9C9", surface:"#FFFFFF" };
const AN_W = 600;   /* viewBox width; cards scale it to their own width */
function anNiceMax(v){ if(!(v>0)) return 1; const p=Math.pow(10, Math.floor(Math.log10(v))); const n=v/p; const m= n<=1?1 : n<=2?2 : n<=2.5?2.5 : n<=5?5 : 10; return m*p; }
function anTicks(max, n){ n=n||4; const top=anNiceMax(max); const out=[]; for(let i=0;i<=n;i++) out.push(+(top*i/n).toFixed(6)); return out; }
function anCompact(v){ v=+v||0; const a=Math.abs(v); const s= a>=1e6? (v/1e6).toFixed(1).replace(/\.0$/,"")+"M" : a>=1e3? (v/1e3).toFixed(a>=1e4?0:1).replace(/\.0$/,"")+"K" : String(Math.round(v)); return s; }
function anMoneyCompact(v){ return (v<0?"−":"")+"£"+anCompact(Math.abs(v)); }
const anSvgEsc=(s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* x labels: first, last and every k-th so they never collide */
function anXLabels(labels, maxLabels){ const n=labels.length; if(!n) return []; const k=Math.max(1, Math.ceil(n/(maxLabels||8))); return labels.map((l,i)=> (i===0||i===n-1||i%k===0)? l : ""); }
/* one floating tooltip per plot host; labels via textContent */
function anTip(host){
  let tip=host.querySelector(".an-tip"); if(!tip){ tip=document.createElement("div"); tip.className="an-tip"; tip.hidden=true; host.appendChild(tip); }
  return {
    show(x, y, title, rows){ tip.replaceChildren(); const h=document.createElement("div"); h.className="an-tip-title"; h.textContent=title; tip.appendChild(h);
      for(const r of rows){ const row=document.createElement("div"); row.className="an-tip-row"; const key=document.createElement("span"); key.className="an-tip-key"; key.style.background=r.color||"transparent"; const val=document.createElement("strong"); val.textContent=r.value; const lab=document.createElement("span"); lab.className="an-tip-label"; lab.textContent=r.label; row.append(key,val,lab); tip.appendChild(row); }
      tip.hidden=false; const hw=host.clientWidth||600; const tw=tip.offsetWidth||160; tip.style.left=Math.max(0, Math.min(hw-tw, x-tw/2))+"px"; tip.style.top=Math.max(0, y-10-tip.offsetHeight)+"px"; },
    hide(){ tip.hidden=true; },
  };
}
function anLegend(series){ return `<div class="an-legend">${series.map(s=>`<span class="an-legend-item"><i class="${s.line?"an-sw-line":"an-sw-rect"}" style="${s.line?"border-color":"background"}:${s.color}"></i>${anSvgEsc(s.label)}</span>`).join("")}</div>`; }
/* vertical frame: y axis ticks + gridlines, x labels; returns scales */
function anFrame(opts){
  const W=AN_W, H=opts.height||220, padL=opts.padL??44, padR=opts.padR??12, padT=opts.padT??10, padB=opts.padB??26;
  const min=Math.min(0, opts.min||0), max=opts.max; const ticks=anTicks(max, opts.tickCount||4);
  const top=ticks[ticks.length-1]||1, bottom= min<0? -anNiceMax(-min) : 0;
  const plotH=H-padT-padB, plotW=W-padL-padR;
  const y=(v)=> padT + (top - v)/(top-bottom) * plotH;
  const n=opts.n||1, band=plotW/n, x=(i)=> padL + i*band;
  let g="";
  for(const t of ticks){ g+=`<line x1="${padL}" x2="${W-padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${AN_INK.grid}" stroke-width="1"/><text x="${padL-6}" y="${(y(t)+3.5).toFixed(1)}" text-anchor="end" class="an-ax">${anSvgEsc(opts.fmt? opts.fmt(t) : anCompact(t))}</text>`; }
  if(bottom<0){ const nt=anTicks(-bottom, 2).slice(1); for(const t of nt){ g+=`<line x1="${padL}" x2="${W-padR}" y1="${y(-t).toFixed(1)}" y2="${y(-t).toFixed(1)}" stroke="${AN_INK.grid}" stroke-width="1"/><text x="${padL-6}" y="${(y(-t)+3.5).toFixed(1)}" text-anchor="end" class="an-ax">−${anSvgEsc(opts.fmt? opts.fmt(t) : anCompact(t))}</text>`; } }
  g+=`<line x1="${padL}" x2="${W-padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="${AN_INK.axis}" stroke-width="1"/>`;
  const xl=anXLabels(opts.labels||[], opts.maxLabels||8);
  xl.forEach((l,i)=>{ if(l) g+=`<text x="${(x(i)+band/2).toFixed(1)}" y="${H-8}" text-anchor="middle" class="an-ax">${anSvgEsc(l)}</text>`; });
  return { W, H, padL, padR, padT, padB, plotH, plotW, y, x, band, top, bottom, grid:g, y0:y(0) };
}
/* stacked (or single) columns; series=[{key,label,color}], values[i][key] may be negative */
function anColumns(host, data, opts){
  const keys=opts.series.map(s=>s.key), n=data.keys.length;
  const pos=data.keys.map((k,i)=>keys.reduce((s,kk)=>s+Math.max(0,+data.series[kk][i]||0),0));
  const neg=data.keys.map((k,i)=>keys.reduce((s,kk)=>s+Math.min(0,+data.series[kk][i]||0),0));
  const f=anFrame({ height:opts.height||220, max:Math.max(...pos,0), min:Math.min(...neg,0), n, labels:data.labels, fmt:opts.fmt, padL:opts.padL });
  const bw=Math.min(24, Math.max(3, f.band*0.6)), gap=2;
  let bars="";
  data.keys.forEach((k,i)=>{
    const cx=f.x(i)+f.band/2, x0=(cx-bw/2).toFixed(1);
    let yUp=f.y0, yDown=f.y0; const segs=[];
    for(const s of opts.series){ const v=+data.series[s.key][i]||0; if(!v) continue; const h=Math.abs(f.y(0)-f.y(Math.abs(v)));
      if(v>0){ const y1=yUp-h; segs.push({ s, y:y1, h, up:true }); yUp=y1; } else { segs.push({ s, y:yDown, h, up:false }); yDown+=h; } }
    const topSeg=segs.filter(x=>x.up).slice(-1)[0], botSeg=segs.filter(x=>!x.up).slice(-1)[0];
    for(const sg of segs){ const hh=Math.max(0, sg.h-(sg===topSeg||sg===botSeg? 0 : gap)); const yy= sg.up? sg.y+(sg===topSeg?0:gap) : sg.y;
      const r= (sg===topSeg && sg.up)||(sg===botSeg && !sg.up)? 4 : 0;
      const path= r && hh>r? (sg.up? `M${x0},${(yy+hh).toFixed(1)} V${(yy+r).toFixed(1)} a${r},${r} 0 0 1 ${r},-${r} h${(bw-2*r).toFixed(1)} a${r},${r} 0 0 1 ${r},${r} V${(yy+hh).toFixed(1)} Z` : `M${x0},${yy.toFixed(1)} V${(yy+hh-r).toFixed(1)} a${r},${r} 0 0 0 ${r},${r} h${(bw-2*r).toFixed(1)} a${r},${r} 0 0 0 ${r},-${r} V${yy.toFixed(1)} Z`) : null;
      bars+= path? `<path d="${path}" fill="${sg.s.color}"/>` : `<rect x="${x0}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${sg.s.color}"/>`; }
    if(opts.labelTop && pos[i]>0 && n<=16) bars+=`<text x="${cx.toFixed(1)}" y="${(yUp-5).toFixed(1)}" text-anchor="middle" class="an-val">${anSvgEsc(opts.fmt? opts.fmt(pos[i]) : anCompact(pos[i]))}</text>`;
  });
  host.innerHTML=(opts.series.length>1? anLegend(opts.series) : (opts.subtitle? `<div class="an-sub">${anSvgEsc(opts.subtitle)}</div>`:""))+`<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${anSvgEsc(opts.aria||"chart")}" tabindex="0" class="an-svg">${f.grid}${bars}<line class="an-cross" x1="0" x2="0" y1="${f.padT}" y2="${f.padT+f.plotH}" stroke="${AN_INK.axis}" stroke-width="1" visibility="hidden"/></svg>`;
  anCrosshair(host, f, data, opts);
}
/* lines; series=[{key,label,color,dot,endLabel}], refs=[{value,label}] horizontal references */
function anLines(host, data, opts){
  const n=data.keys.length; const vals=[]; for(const s of opts.series) for(const v of data.series[s.key]) if(v!=null) vals.push(+v);
  for(const r of opts.refs||[]) if(r.value!=null) vals.push(+r.value);
  const f=anFrame({ height:opts.height||220, max:Math.max(...vals,0), n, labels:data.labels, fmt:opts.fmt, padR:opts.endLabels? 56 : 12 });
  const px=(i)=>f.x(i)+f.band/2;
  let g="";
  for(const r of opts.refs||[]){ if(r.value==null) continue; const yy=f.y(r.value).toFixed(1); g+=`<line x1="${f.padL}" x2="${f.W-f.padR}" y1="${yy}" y2="${yy}" stroke="${AN_INK.muted}" stroke-width="1"/><text x="${f.W-f.padR-2}" y="${(+yy-4).toFixed(1)}" text-anchor="end" class="an-ax">${anSvgEsc(r.label)}</text>`; }
  for(const s of opts.series){
    const pts=data.keys.map((k,i)=>[px(i), data.series[s.key][i]==null? null : f.y(+data.series[s.key][i])]);
    let d="", pen=false; pts.forEach(([x,y])=>{ if(y==null){ pen=false; return; } d+= (pen? "L":"M")+x.toFixed(1)+","+y.toFixed(1); pen=true; });
    if(s.area) g+=`<path d="${d} L${pts[pts.length-1][0].toFixed(1)},${f.y0.toFixed(1)} L${pts[0][0].toFixed(1)},${f.y0.toFixed(1)} Z" fill="${s.color}" opacity=".1"/>`;
    g+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last=[...pts].reverse().find(p=>p[1]!=null);
    if(last){ g+=`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${s.color}" stroke="${AN_INK.surface}" stroke-width="2"/>`;
      if(opts.endLabels && s.endLabel!==false){ const i=data.keys.length-1; const v=[...data.series[s.key]].reverse().find(x=>x!=null); g+=`<text x="${(last[0]+8).toFixed(1)}" y="${(last[1]+4).toFixed(1)}" class="an-val">${anSvgEsc(opts.fmt? opts.fmt(v) : anCompact(v))}</text>`; } }
  }
  host.innerHTML=(opts.series.length>1? anLegend(opts.series.map(s=>({...s, line:true}))) : (opts.subtitle? `<div class="an-sub">${anSvgEsc(opts.subtitle)}</div>`:""))+`<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${anSvgEsc(opts.aria||"chart")}" tabindex="0" class="an-svg">${f.grid}${g}<line class="an-cross" x1="0" x2="0" y1="${f.padT}" y2="${f.padT+f.plotH}" stroke="${AN_INK.axis}" stroke-width="1" visibility="hidden"/><g class="an-cross-dots"></g></svg>`;
  anCrosshair(host, f, data, opts);
}
/* crosshair + tooltip for bucketed charts: nearest bucket on pointer / arrow keys, every series listed */
function anCrosshair(host, f, data, opts){
  const svg=host.querySelector("svg"), cross=svg.querySelector(".an-cross"), dots=svg.querySelector(".an-cross-dots"), tip=anTip(host);
  const n=data.keys.length; if(!n) return; let idx=-1;
  const show=(i)=>{ idx=i; const cx=f.x(i)+f.band/2; cross.setAttribute("x1",cx); cross.setAttribute("x2",cx); cross.setAttribute("visibility","visible");
    if(dots){ dots.innerHTML=opts.series.map(s=>{ const v=data.series[s.key][i]; return v==null? "" : `<circle cx="${cx.toFixed(1)}" cy="${f.y(+v).toFixed(1)}" r="4" fill="${s.color}" stroke="${AN_INK.surface}" stroke-width="2"/>`; }).join(""); }
    const rect=svg.getBoundingClientRect(); const sx=rect.width/f.W;
    tip.show(cx*sx, f.padT*sx, data.labels[i]||data.keys[i], opts.series.map(s=>({ color:s.color, label:s.label, value: data.series[s.key][i]==null? "—" : (opts.fmtTip||opts.fmt||anCompact)(data.series[s.key][i]) })).concat(opts.tipExtra? opts.tipExtra(i) : [])); };
  const hide=()=>{ idx=-1; cross.setAttribute("visibility","hidden"); if(dots) dots.innerHTML=""; tip.hide(); };
  svg.addEventListener("pointermove",(e)=>{ const r=svg.getBoundingClientRect(); const xv=(e.clientX-r.left)/r.width*f.W; let i=Math.floor((xv-f.padL)/f.band); if(i<0) i=0; if(i>n-1) i=n-1; if(xv<f.padL-8||xv>f.W-f.padR+8){ hide(); return; } show(i); });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("keydown",(e)=>{ if(e.key==="ArrowRight"){ show(Math.min(n-1, idx<0? 0 : idx+1)); e.preventDefault(); } else if(e.key==="ArrowLeft"){ show(Math.max(0, idx<0? n-1 : idx-1)); e.preventDefault(); } else if(e.key==="Escape") hide(); });
  svg.addEventListener("blur", hide);
}
/* horizontal bars with the value at the tip; rows=[{label, value, sub?}] */
function anHBars(host, rows, opts){
  const max=Math.max(...rows.map(r=>+r.value||0), 0); const padL=opts.padL||150, padR=70, rowH=28, W=AN_W, H=rows.length*rowH+8;
  const scale=(v)=> max? (W-padL-padR)*(v/max) : 0;
  let g="";
  rows.forEach((r,i)=>{ const y=4+i*rowH, w=Math.max(0, scale(+r.value||0)), bw=Math.min(24, rowH-6); const yy=y+(rowH-bw)/2; const rr=w>4? 4 : 0;
    const path= rr? `M${padL},${yy} h${(w-rr).toFixed(1)} a${rr},${rr} 0 0 1 ${rr},${rr} v${bw-2*rr} a${rr},${rr} 0 0 1 -${rr},${rr} h-${(w-rr).toFixed(1)} Z` : null;
    g+=`<g class="an-hrow${opts.onClick?" an-clickable":""}" data-i="${i}" tabindex="0"><rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>`+
       `<text x="${padL-8}" y="${y+rowH/2+4}" text-anchor="end" class="an-cat">${anSvgEsc(r.label.length>22? r.label.slice(0,21)+"…" : r.label)}</text>`+
       (path? `<path d="${path}" fill="${r.color||opts.color||AN_SERIES.retail}"/>` : "")+
       `<text x="${(padL+w+6).toFixed(1)}" y="${y+rowH/2+4}" class="an-val">${anSvgEsc(opts.fmt? opts.fmt(r.value, r) : anCompact(r.value))}</text></g>`; });
  host.innerHTML=(opts.subtitle? `<div class="an-sub">${anSvgEsc(opts.subtitle)}</div>`:"")+`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${anSvgEsc(opts.aria||"bars")}" class="an-svg">${g}</svg>`;
  const tip=anTip(host), svg=host.querySelector("svg");
  svg.querySelectorAll(".an-hrow").forEach(gEl=>{ const i=+gEl.dataset.i, r=rows[i];
    const showTip=()=>{ const rect=svg.getBoundingClientRect(), sx=rect.width/W; tip.show((padL+Math.max(40,scale(+r.value||0))/2)*sx, (4+i*rowH)*sx, r.label, [{ color:r.color||opts.color||AN_SERIES.retail, label:opts.valueLabel||"value", value:opts.fmt? opts.fmt(r.value, r) : anCompact(r.value) }].concat(r.tip||[])); gEl.classList.add("an-hot"); };
    const hideTip=()=>{ tip.hide(); gEl.classList.remove("an-hot"); };
    gEl.addEventListener("pointerenter", showTip); gEl.addEventListener("pointerleave", hideTip); gEl.addEventListener("focus", showTip); gEl.addEventListener("blur", hideTip);
    if(opts.onClick){ gEl.addEventListener("click",()=>opts.onClick(r, i)); gEl.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); opts.onClick(r, i); } }); }
  });
}
/* meter rows: [{label, pct, fillColor, right, sub}] — track is a lighter step of the fill */
function anMeters(host, rows, opts){
  host.innerHTML=(opts&&opts.subtitle? `<div class="an-sub">${anSvgEsc(opts.subtitle)}</div>`:"")+`<div class="an-meters">`+rows.map(r=>`<div class="an-meter-row" title="${anSvgEsc(r.title||"")}"><div class="an-meter-lab">${anSvgEsc(r.label)}</div><div class="an-meter an-meter-wide"><div class="an-meter-fill" style="width:${Math.max(0,Math.min(100,+r.pct||0)).toFixed(1)}%;background:${r.color||AN_SERIES.retail}"></div></div><div class="an-meter-right">${r.right||""}</div><div class="an-meter-sub">${r.sub||""}</div></div>`).join("")+`</div>`;
}

/* ---- card renderers (chunk 5: A1 A2 A3 A6 B9 B10) ---- */
(function(){
  const C=AnalyticsCore, card=(id)=>AN_CARDS.find(c=>c.id===id);
  const money=(v)=>anMoneyCompact(v), moneyFull=(v)=>C.fmtGBP(v);
  const SERIES=[{key:"retail",label:"Retail",color:AN_SERIES.retail},{key:"club",label:"Club shop",color:AN_SERIES.club},{key:"wholesale",label:"Wholesale",color:AN_SERIES.wholesale},{key:"unattributed",label:"Unattributed",color:AN_SERIES.unattributed}];
  card("A1").draw=(d, c, host)=>{ const live=SERIES.filter(s=>d.totals[s.key]!==0 || s.key==="retail"); anColumns(host, d, { series:live, fmt:money, fmtTip:moneyFull, aria:"Revenue by channel", tipExtra:(i)=>[{ color:"transparent", label:"total", value:moneyFull(d.rows[i].total) }] }); };
  card("A2").draw=(d, c, host)=>{ host.innerHTML=`<div class="an-panel"></div><div class="an-panel"></div>`; const [p1,p2]=host.querySelectorAll(".an-panel");
    anColumns(p1, { keys:d.keys, labels:d.labels, series:{ orders:d.orders } }, { series:[{key:"orders",label:"Orders",color:AN_INK.body}], height:150, fmt:(v)=>anCompact(v), subtitle:"Orders", aria:"Orders per period", labelTop:true });
    anColumns(p2, { keys:d.keys, labels:d.labels, series:{ revenue:d.revenue } }, { series:[{key:"revenue",label:"Revenue",color:AN_SERIES.retail}], height:150, fmt:money, fmtTip:moneyFull, subtitle:"Revenue, net of refunds", aria:"Revenue per period" }); };
  card("A3").draw=(d, c, host)=>{ anLines(host, { keys:d.keys, labels:d.labels, series:{ aov:d.aov, rolling:d.rolling } }, { series:[{key:"aov",label:"AOV per period",color:AN_SERIES.retail},{key:"rolling",label:"30-day rolling mean",color:AN_SERIES.wholesale,endLabel:false}], refs:[{ value:d.baseline, label:"baseline "+C.fmtGBP(d.baseline) }], fmt:money, fmtTip:moneyFull, endLabels:true, aria:"Average order value trend" }); };
  card("A6").draw=(d, c, host)=>{ const series={ cumulative:d.cumulative }; const s=[{key:"cumulative",label:"Cumulative revenue",color:AN_SERIES.retail,area:true}];
    anLines(host, { keys:d.keys, labels:d.labels, series }, { series:s, refs: d.target? [{ value:d.target, label:"target "+C.fmtGBP(d.target) }] : [], fmt:money, fmtTip:moneyFull, endLabels:true, subtitle:"Cumulative revenue, net of refunds", aria:"Cumulative revenue vs target", maxLabels:6 }); };
  card("B9").draw=(d, c, host)=>{ const metric=an.b9.metric; const rows=d.rows.slice(0,14).map(r=>({ label:r.label, value:r[metric], key:r.key, tip:[{ color:"transparent", label: metric==="units"? "revenue" : "units", value: metric==="units"? C.fmtGBP(r.revenue) : String(r.units) },{ color:"transparent", label:"orders", value:String(r.orders) }] }));
    const canDrill=an.b9.level!=="size";
    anHBars(host, rows, { fmt: metric==="units"? (v)=>String(Math.round(v)) : moneyFull, valueLabel: metric, color:AN_SERIES.retail, aria:"Revenue and units by product", subtitle: d.rows.length>14? `top 14 of ${d.rows.length}` : "", onClick: canDrill? (r)=>{ if(an.b9.level==="product"){ an.b9.level="colourway"; an.b9.parent=r.key; } else { an.b9.level="size"; an.b9.parent=r.key; } renderAnalytics(); } : null }); };
  card("B10").draw=(d, c, host)=>{ const lab={red:"⚠ under 4 wks",amber:"⚠ under 8 wks",ok:"✓ ok",static:"no recent sales",out:"sold out"};
    anMeters(host, d.rows.map(r=>({ label:r.name, pct:r.sellThrough||0, color: r.status==="red"? AN_STATUS.red : r.status==="amber"? AN_STATUS.amber : AN_SERIES.retail, right:`<strong>${r.sellThrough==null?"—":C.fmtPct(r.sellThrough)}</strong>`, sub:`${r.sold} sold / ${r.received} received${r.implied?" (implied)":""} · ${r.stock} on hand · ${r.weeksOfCover==null?"—":r.weeksOfCover+" wks"} cover · ${lab[r.status]||r.status}`, title:`${r.name}: ${r.sold} sold of ${r.received} received` })), { subtitle:"Sell-through (sold ÷ received) · bar colour = weeks of cover status" }); };
})();

/* ---- card renderers (chunk 6: C15 C19 D21 D22 E26 F30 F33 F35 G37) ---- */
(function(){
  const C=AnalyticsCore, card=(id)=>AN_CARDS.find(c=>c.id===id);
  const money=(v)=>anMoneyCompact(v), moneyFull=(v)=>C.fmtGBP(v), count=(v)=>String(Math.round(+v||0));
  const ATTR_COLOR={ facebook:AN_SERIES.retail, instagram:AN_SERIES.retail, fb:AN_SERIES.retail, ig:AN_SERIES.retail, meta:AN_SERIES.retail, direct:AN_SERIES.club, "meta-click":AN_SERIES.wholesale, unattributed:AN_SERIES.unattributed, other:AN_SERIES.wholesale };
  card("C15").draw=(d, c, host)=>{ anColumns(host, { keys:d.keys, labels:d.labels, series:{ new:d.new, returning:d.returning, unknown:d.unknown } }, { series:[{key:"new",label:"New",color:AN_SERIES.retail},{key:"returning",label:"Returning",color:AN_SERIES.club},{key:"unknown",label:"No customer key",color:AN_SERIES.unattributed}].filter(s=>s.key!=="unknown"||C.sum(d.unknown)>0), fmt:count, aria:"New vs returning customers" }); };
  card("C19").draw=(d, c, host)=>{ host.innerHTML=`<div class="an-panel"></div><div class="an-panel"></div>`; const [p1,p2]=host.querySelectorAll(".an-panel");
    anHBars(p1, d.countries.slice(0,8).map(x=>({ label:x.country, value:x.orders, tip:[{color:"transparent",label:"revenue",value:moneyFull(x.revenue)}] })), { fmt:count, valueLabel:"orders", color:AN_SERIES.club, subtitle:"Orders by country", aria:"Orders by country", padL:110 });
    anHBars(p2, d.ukAreas.slice(0,10).map(x=>({ label:x.area, value:x.orders, tip:[{color:"transparent",label:"revenue",value:moneyFull(x.revenue)}] })), { fmt:count, valueLabel:"orders", color:AN_SERIES.retail, subtitle:"UK orders by postcode area", aria:"UK orders by postcode area", padL:110 }); };
  card("D21").draw=(d, c, host)=>{ const top=d.sources.slice(0,3), rest=d.sources.slice(3); const series={}; top.forEach(s=>series[s]=d.series[s]);
    if(rest.length) series.other=d.keys.map((k,i)=>rest.reduce((a,s)=>a+(d.series[s][i]||0),0));
    const specs=top.map(s=>({ key:s, label:d.sourceLabel[s], color:ATTR_COLOR[s]||AN_SERIES.wholesale })).concat(rest.length? [{ key:"other", label:`Other (${rest.length})`, color:AN_SERIES.unattributed }] : []);
    anColumns(host, { keys:d.keys, labels:d.labels, series }, { series:specs, fmt:money, fmtTip:moneyFull, aria:"Revenue by attribution source" }); };
  card("D22").draw=(d, c, host)=>{ host.innerHTML=`<div class="an-panel"></div><div class="an-panel"></div>`; const [p1,p2]=host.querySelectorAll(".an-panel");
    anColumns(p1, { keys:d.keys, labels:d.labels, series:{ spend:d.spend } }, { series:[{key:"spend",label:"Meta spend",color:AN_SERIES.wholesale}], height:140, fmt:money, fmtTip:moneyFull, subtitle:"Meta spend", aria:"Meta spend per period" });
    anColumns(p2, { keys:d.keys, labels:d.labels, series:{ revenue:d.revenue } }, { series:[{key:"revenue",label:"Attributed revenue",color:AN_SERIES.retail}], height:140, fmt:money, fmtTip:moneyFull, subtitle:"Attributed revenue (utm facebook / instagram)", aria:"Attributed revenue per period", tipExtra:(i)=>[{ color:"transparent", label:"ROAS", value: d.roas[i]==null? "—" : d.roas[i].toFixed(2)+"×" }] }); };
  const RAMP=["#8FA5FF","#6A88FF","#4A6DFF","#2E5BFF","#1E3FCC"];   /* one hue, light→dark: ordinal funnel steps */
  card("E26").draw=(d, c, host)=>{ anHBars(host, d.steps.map((s,i)=>({ label:s.label, value:s.users, color:RAMP[i], tip:[{color:"transparent",label:"of page views",value:C.fmtPct(s.pctOfFirst)},{color:"transparent",label:"of previous step",value:C.fmtPct(s.pctOfPrev)},{color:"transparent",label:s.source==="stripe"?"source":"source",value:s.source==="stripe"?"Stripe paid orders":"GA4 users"}] })), { fmt:(v,r)=>`${count(v)} · ${C.fmtPct(r.tip[1].value.replace("%",""))} of prev`, valueLabel:"users", subtitle:`${d.days} GA4 day${d.days===1?"":"s"} in range · purchase step from Stripe`, aria:"Checkout funnel", padL:130 }); };
  card("F30").draw=(d, c, host)=>{ const o=anOpts(); const b=C.bucketsBetween(o.from,o.to,o.grain); const idx=new Map(b.map((k,i)=>[k,i])); const refunds=b.map(()=>0), disputes=b.map(()=>0);
    for(const e of d.table){ const i=idx.get(C.bucketKey(e.date,o.grain)); if(i==null) continue; (e.type==="refund"? refunds : disputes)[i]+=e.amount; }
    anColumns(host, { keys:b, labels:b.map(k=>C.bucketLabel(k,o.grain)), series:{ refunds, disputes } }, { series:[{key:"refunds",label:"Refunds",color:AN_SERIES.retail},{key:"disputes",label:"Lost disputes",color:AN_SERIES.club}], fmt:money, fmtTip:moneyFull, aria:"Refunds and disputes per period" }); };
  card("F33").draw=(d, c, host)=>{ anColumns(host, { keys:d.keys, labels:d.labels, series:{ paid:d.paid, pending:d.pending } }, { series:[{key:"paid",label:"Paid out",color:AN_SERIES.retail},{key:"pending",label:"Pending / in transit",color:AN_SERIES.wholesale}], fmt:money, fmtTip:moneyFull, aria:"Stripe payouts per period" });
    host.insertAdjacentHTML("afterbegin", `<div class="an-sub">Available ${anSvgEsc(moneyFull(d.balance.available))} · pending ${anSvgEsc(moneyFull(d.balance.pending))}</div>`); };
  card("F35").draw=(d, c, host)=>{ const keys=d.series.map(s=>s.key); anLines(host, { keys, labels:keys.map(k=>C.bucketLabel(k.slice(0,7),"month")), series:{ turnover:d.series.map(s=>s.turnover) } }, { series:[{key:"turnover",label:"Trailing 12-month turnover",color: d.status==="red"? AN_STATUS.red : d.status==="amber"? AN_STATUS.amber : AN_SERIES.retail, area:true}], refs:[{ value:d.threshold, label:"£90k threshold" },{ value:C.VAT_AMBER, label:"amber £75k" }], fmt:money, fmtTip:moneyFull, endLabels:true, subtitle:`${C.fmtPct(d.pct)} of the threshold · ${d.projectedCrossing? (d.turnover>=d.threshold? "crossed" : "crossing ≈ "+fmtDate(d.projectedCrossing)) : "no run-rate yet"}`, aria:"Rolling 12-month turnover vs VAT threshold", maxLabels:6 }); };
  card("G37").draw=(d, c, host)=>{ host.innerHTML=`<div class="an-multiples">${d.cards.map((k,i)=>`<div class="an-multiple" data-i="${i}"><div class="an-multiple-head"><strong>${anSvgEsc(k.club)}</strong><span class="proton-spec" style="text-transform:none">${k.window? `${fmtDate(k.window.start)} – ${fmtDate(k.window.end)} · ${k.open? (k.daysLeft+" day"+(k.daysLeft===1?"":"s")+" left") : (k.daysLeft<0? "closed "+(-k.daysLeft)+" day"+(k.daysLeft===-1?"":"s")+" ago" : "opens in "+k.daysLeft+" days")}` : "no window set"} · ${k.orders} order${k.orders===1?"":"s"} · ${k.units} units · ${anSvgEsc(C.fmtGBP(k.value))}</span></div><div class="an-multiple-plot"></div><div class="proton-spec an-multiple-foot" style="text-transform:none">${anSvgEsc(k.byProduct.slice(0,4).map(p=>`${p.name} ×${p.units} (${Object.entries(p.sizes).map(([s,q])=>s+" "+q).join(", ")})`).join(" · ")||"no line items")}</div></div>`).join("")}</div>`;
    host.querySelectorAll(".an-multiple").forEach(el=>{ const k=d.cards[+el.dataset.i]; const plot=el.querySelector(".an-multiple-plot"); const keys=k.curve.keys; if(!keys.length){ plot.innerHTML=`<div class="an-empty">no orders yet</div>`; return; }
      anLines(plot, { keys, labels:keys.map(x=>C.bucketLabel(x,"day")), series:{ cum:k.curve.cumulative } }, { series:[{key:"cum",label:"Cumulative orders",color:AN_SERIES.retail,area:true}], fmt:count, height:120, endLabels:true, aria:`Cumulative orders — ${k.club}`, maxLabels:4 });
      const svg=plot.querySelector("svg"); if(svg && k.curve.deadlineIndex!=null){ const f={ padL:44, padR:56, W:AN_W }; const band=(AN_W-f.padL-f.padR)/keys.length; const x=(f.padL+k.curve.deadlineIndex*band+band/2).toFixed(1); svg.insertAdjacentHTML("beforeend", `<line x1="${x}" x2="${x}" y1="10" y2="94" stroke="${AN_INK.strong}" stroke-width="1"/><text x="${x}" y="8" text-anchor="middle" class="an-ax">deadline</text>`); } }); };
})();

/* ---------- render + events ---------- */
