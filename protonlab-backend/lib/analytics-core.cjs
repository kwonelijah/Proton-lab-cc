/* lib/analytics-core.cjs — the ONE source of truth for the analytics maths.
   Pure functions over the unified order-row shape that api/analytics.js builds
   from Stripe and that the dashboard builds for manual (bank-transfer) and
   wholesale orders. Nothing here touches Stripe, the DOM or the network.

   This file is ALSO inlined into ~/Desktop/Proton Dashboard/order-dashboard.html
   by scripts/inline-analytics-core.mjs (between the ANALYTICS-CORE markers),
   so it must stay a classic script: one IIFE, no require/process/Buffer, no
   named exports, no top-level helpers outside the IIFE, no "</script>".
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
    const purchases = filterRows(ctx.rows, { ...opts, channel: 'all' }).length;
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
