import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import core from '../lib/analytics-core.cjs';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/analytics-rows.json', import.meta.url), 'utf8'));
const spend = []; for (let d = 1; d <= 31; d++) spend.push({ date: `2026-10-${String(d).padStart(2, '0')}`, spend: 10 });
const ctx = { ...fx, spend };
const OCT = { from: '2026-10-01', to: '2026-10-31' };

test('formatters and dates', () => {
  assert.equal(core.fmtGBP(1234.5), '£1,234.50');
  assert.equal(core.fmtGBP(-3), '−£3.00');
  assert.equal(core.fmtPct(12.345), '12.3%');
  assert.equal(core.fmtPct(null), '—');
  assert.equal(core.mondayOf('2026-11-01'), '2026-10-26');
  assert.equal(core.monthEnd('2026-02-10'), '2026-02-28');
  assert.deepEqual(core.bucketsBetween('2026-09-15', '2026-11-01', 'month'), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(core.bucketsBetween('2026-10-28', '2026-11-03', 'week'), ['2026-10-26', '2026-11-02']);
  assert.equal(core.bucketsBetween('2026-10-01', '2026-10-05', 'day').length, 5);
  assert.equal(core.bucketLabel('2026-10', 'month'), 'Oct 26');
  assert.equal(core.bucketLabel('2026-10-26', 'week'), 'w/c 26 Oct');
});

test('classification helpers', () => {
  assert.equal(core.channelOfMeta({ channel: 'club' }), 'club');
  assert.equal(core.channelOfMeta({ club_handle: 'ucl-cycling', club: 'UCL Cycling' }), 'club');
  assert.equal(core.channelOfMeta({ club: 'Bath CC' }), 'club');
  assert.equal(core.channelOfMeta({ club: 'Proton Lab', items: '[]' }), 'retail');
  assert.equal(core.channelOfMeta({}), 'unattributed');
  assert.equal(core.postcodeArea('eh1 2ab', 'GB'), 'EH');
  assert.equal(core.postcodeArea('N1 9GU', 'GB'), 'N');
  assert.equal(core.postcodeArea('10115', 'DE'), '');
  assert.deepEqual(core.skuMeta('red-sky-jersey'), { product: 'Summer Jersey', colourway: 'Red Sky' });
  assert.deepEqual(core.skuMeta('ss-race-jersey', 'SS Race Jersey'), { product: 'SS Race Jersey', colourway: '—' });
  assert.equal(core.attributionBucket({ utm: { source: 'facebook' } }), 'facebook');
  assert.equal(core.attributionBucket({ utm: { attributed: true } }), 'direct');
  assert.equal(core.attributionBucket({ utm: { fbc: true } }), 'meta-click');
  assert.equal(core.attributionBucket({ utm: {} }), 'unattributed');
  assert.equal(core.customerKey({ email: ' A@X.com ' }), 'a@x.com');
  assert.equal(core.customerKey({ email: '', phone: '07000 000000' }), 'tel:07000000000');
});

test('A1 revenue by channel is net of refunds by refund date', () => {
  const r = core.revenueByChannel(ctx, { ...OCT, grain: 'month' });
  assert.deepEqual(r.keys, ['2026-10']);
  assert.equal(r.totals.retail, 397.69);
  assert.equal(r.totals.club, 4.99);          // 90.99 − 86 refund (Oct 28)
  assert.equal(r.totals.wholesale, 297.5);
  assert.equal(r.totals.unattributed, 0);
  assert.equal(r.total, 700.18);
  const sep = core.revenueByChannel(ctx, { from: '2026-09-01', to: '2026-09-30', grain: 'month' });
  assert.equal(sep.totals.club, 81);          // the lost dispute is not a refund
  const onlyClub = core.revenueByChannel(ctx, { ...OCT, grain: 'month', channel: 'club' });
  assert.equal(onlyClub.totals.retail, 0); assert.equal(onlyClub.totals.club, 4.99);
  const onlyRetail = core.revenueByChannel(ctx, { ...OCT, grain: 'month', channel: 'retail' });
  assert.equal(onlyRetail.total, 397.69);     // the club refund must not leak into retail
});

test('A2 / A3 / A6', () => {
  const o = core.ordersVsRevenue(ctx, { ...OCT, grain: 'month' });
  assert.deepEqual(o.orders, [5]); assert.deepEqual(o.revenue, [700.18]);
  const a = core.aovSeries(ctx, { ...OCT, grain: 'month' });
  assert.equal(a.current, 122.17); assert.equal(a.baseline, 135); assert.equal(a.vsBaseline, -9.5);
  assert.deepEqual(a.aov, [122.17]);   // site orders only — the wholesale invoice is excluded from AOV
  assert.equal(a.rolling[0], 122.17);          // trailing 30 days to 31 Oct = the same five orders
  const c = core.cumulativeRevenue(ctx, { ...OCT, target: 1000 });
  assert.equal(c.total, 700.18); assert.equal(c.keys.length, 31); assert.equal(c.target, 1000);
});

test('B9 SKU drill-down', () => {
  const p = core.bySku(ctx, { ...OCT, level: 'product' });
  const sj = p.rows.find((x) => x.key === 'Summer Jersey');
  assert.equal(sj.units, 7); assert.equal(sj.revenue, 478.2); assert.equal(sj.orders, 3);
  assert.equal(p.rows[0].key, 'Summer Jersey');
  const c = core.bySku(ctx, { ...OCT, level: 'colourway', parent: 'Summer Jersey' });
  assert.deepEqual(c.rows.map((x) => [x.label, x.units]), [['Sunset', 5], ['Ocean Blue', 1], ['Red Sky', 1]]);
  const s = core.bySku(ctx, { ...OCT, level: 'size', parent: 'Summer Jersey|Sunset', metric: 'revenue' });
  assert.deepEqual(s.rows.map((x) => [x.label, x.units, x.revenue]), [['S', 3, 178.5], ['M', 2, 119]]);
});

test('B10 sell-through and weeks of cover', () => {
  const st = core.sellThrough(ctx, { asOf: '2026-11-01' });
  const sun = st.rows.find((x) => x.handle === 'sunset-jersey');
  assert.equal(sun.sold, 6); assert.equal(sun.received, 15); assert.equal(sun.implied, false);
  assert.equal(sun.sellThrough, 40); assert.equal(sun.stock, 9); assert.equal(sun.weeklyRate, 1.5);
  assert.equal(sun.weeksOfCover, 6); assert.equal(sun.status, 'amber');
  const red = st.rows.find((x) => x.handle === 'red-sky-jersey');
  assert.equal(red.sold, 2, 'the 2025 order counts too — sell-through is all-time'); assert.equal(red.received, 5); assert.equal(red.implied, true); assert.equal(red.sellThrough, 40);
  assert.equal(red.weeksOfCover, 12); assert.equal(red.status, 'ok');
  const bib = st.rows.find((x) => x.handle === 'black-bib-shorts');
  assert.equal(bib.stock, 0); assert.equal(bib.status, 'red');
  assert.ok(!st.rows.some((x) => x.handle === 'ss-race-jersey'), 'club kit is not stock-held');
});

test('C15 new vs returning + repeat rate', () => {
  const n = core.newVsReturning(ctx, { from: '2026-09-01', to: '2026-11-30', grain: 'month' });
  assert.deepEqual(n.keys, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(n.new, [1, 3, 1]); assert.deepEqual(n.returning, [0, 1, 0]); assert.deepEqual(n.unknown, [0, 1, 0]);
  const r = core.repeatRate(ctx);
  assert.equal(r.customers, 6); assert.equal(r.repeaters, 1); assert.equal(r.rate, 16.67);
});

test('C19 geography', () => {
  const g = core.geo(ctx, OCT);
  assert.deepEqual(g.countries.map((x) => [x.country, x.orders]), [['GB', 4], ['DE', 1]]);
  assert.deepEqual(g.ukAreas.map((x) => x.area).sort(), ['BS', 'EH', 'N'].sort());
  assert.equal(g.ukAreas.find((x) => x.area === 'EH').orders, 2);
});

test('D21 attribution + D22 ROAS/CAC', () => {
  const a = core.attribution(ctx, { ...OCT, grain: 'month' });
  assert.deepEqual(a.sources, ['unattributed', 'instagram', 'facebook', 'direct']);
  assert.equal(a.totals.find((t) => t.source === 'unattributed').revenue, 388.49);
  assert.equal(a.sourceLabel.direct, 'Direct');
  const r = core.roas(ctx, { ...OCT, grain: 'month' });
  assert.equal(r.totals.spend, 310); assert.equal(r.totals.revenue, 301.99); assert.equal(r.totals.roas, 0.97);
  assert.equal(r.totals.attributedOrders, 2); assert.equal(r.totals.newCustomers, 1); assert.equal(r.totals.cac, 310);
});

test('E26 funnel uses GA4 users and Stripe purchases', () => {
  const f = core.funnel(ctx, OCT);
  assert.deepEqual(f.steps.map((s) => s.users), [180, 90, 18, 10, 4], 'purchase = site orders only (wholesale excluded)');
  assert.equal(f.steps[4].source, 'stripe'); assert.equal(f.steps[4].pctOfFirst, 2.22); assert.equal(f.steps[1].pctOfPrev, 50);
  assert.equal(core.funnel({ rows: [] }, OCT).configured, false);
});

test('F30 refunds & disputes by SKU', () => {
  const r = core.refundsBySku(ctx, OCT);
  assert.equal(r.totals.count, 2); assert.equal(r.totals.amount, 167); assert.equal(r.totals.refunds, 1); assert.equal(r.totals.disputes, 1);
  assert.deepEqual(r.bySku.map((x) => [x.label, x.amount]), [['SS Race Jersey', 86], ['Training Bib Shorts', 81]]);
  assert.deepEqual(r.bySize.map((x) => [x.size, x.amount]), [["Men's M", 86], ["Women's S", 81]]);
  assert.equal(r.table[0].type, 'refund'); assert.equal(r.table[0].reason, 'requested_by_customer');
  assert.equal(core.refundsBySku(ctx, { ...OCT, channel: 'retail' }).totals.count, 0);
});

test('F33 payouts & balance', () => {
  const p = core.payoutsSeries(ctx, { from: '2026-10-01', to: '2026-11-07', grain: 'week' });
  assert.equal(core.sum(p.paid), 550); assert.equal(core.sum(p.pending), 120);
  assert.equal(p.rows.length, 3, 'failed payouts are dropped');
  assert.equal(p.balance.available, 412.5); assert.equal(p.balance.pending, 120);
});

test('F35 rolling 12-month turnover vs VAT threshold', () => {
  const r = core.rolling12(ctx, { asOf: '2026-11-01' });
  assert.equal(r.turnover, 866.18);               // gross incl. shipping, every channel, less the refund; the 2025-10-15 order has rolled off
  assert.equal(r.status, 'ok'); assert.equal(r.headroom, 89133.82); assert.equal(r.threshold, 90000);
  assert.equal(r.runRatePerDay, 9.62);
  assert.ok(r.projectedCrossing > '2026-11-01');
  assert.equal(r.series.length, 12); assert.equal(r.series[10].key, '2026-10-31'); assert.equal(r.series[11].key, '2026-11-01');
  assert.equal(core.rolling12({ rows: [{ id: 'x', paidAt: '2026-10-01', grossGbp: 86000 }] }, { asOf: '2026-11-01' }).status, 'red');
  assert.equal(core.rolling12({ rows: [{ id: 'x', paidAt: '2026-10-01', grossGbp: 76000 }] }, { asOf: '2026-11-01' }).status, 'amber');
});

test('gross margin + KPI tiles', () => {
  const gm = core.grossMargin(ctx, OCT);
  assert.equal(gm.revenue, 690.2); assert.equal(gm.cogs, 324); assert.equal(gm.margin, 53.06); assert.equal(gm.costed, 5); assert.equal(gm.uncosted, 0);
  const k = core.kpis(ctx, { ...OCT, asOf: '2026-11-01' });
  assert.equal(k.revenueMtd, 85); assert.equal(k.revenueLastMonth, 700.18); assert.equal(k.revenueDelta, -87.86);
  assert.equal(k.ordersMtd, 1); assert.equal(k.aov, 122.17); assert.equal(k.aovVsBaseline, -9.5);
  assert.equal(k.refundRate, 10.94); assert.equal(k.refundedRange, 86); assert.equal(k.refundedOrders, 1);
  assert.equal(k.repeat.rate, 16.67); assert.equal(k.balance.available, 412.5);
  assert.equal(k.rolling12.turnover, 866.18); assert.equal(k.roas.roas, 0.97);
  assert.equal(core.kpis({ rows: [], refunds: [] }, { ...OCT, asOf: '2026-11-01' }).aov, null);
});

test('G37 club cards', () => {
  const cards = core.clubCards(ctx, { asOf: '2026-11-01' });
  const ucl = cards.find((c) => c.clubHandle === 'ucl-cycling');
  assert.equal(ucl.orders, 1); assert.equal(ucl.units, 1); assert.equal(ucl.value, 86); assert.equal(ucl.daysLeft, -4); assert.equal(ucl.open, false);
  assert.equal(ucl.window.label, 'Oct window'); assert.equal(ucl.curve.deadlineIndex, 13); assert.equal(ucl.curve.cumulative.at(-1), 1);
  assert.deepEqual(ucl.byProduct[0].sizes, { "Men's M": 1 });
  const bath = cards.find((c) => c.clubHandle === 'university-of-bath-cycling-club');
  assert.equal(bath.window, null); assert.equal(bath.orders, 1);
});

test('CSV export quotes properly', () => {
  const csv = core.toCSV([{ a: 'x,y', b: 'say "hi"', c: 3 }], ['a', 'b', { key: 'c', label: 'Count' }]);
  assert.equal(csv, 'a,b,Count\r\n"x,y","say ""hi""",3');
});

test('bank-transfer invoice rows count in revenue and turnover but not in AOV or the funnel', () => {
  const inv = { id: 'inv_1', source: 'invoice', created: '2026-10-20T12:00:00Z', paidAt: '2026-10-20T12:00:00Z', currency: 'gbp', channel: 'club', clubHandle: 'ucl-cycling', club: 'UCL Cycling', email: 'captain@ucl.ac.uk', phone: '', country: 'GB', postcodeArea: '', gross: 3000, grossGbp: 3000, fee: 0, net: 3000, fx: 1, shippingGbp: 0, discountGbp: 0, subtotalGbp: 3000, refundedGbp: 0, dispute: null, items: [{ handle: 'ss-race-jersey', name: 'SS Race Jersey', size: 'M', qty: 40, lineGbp: 3000 }], utm: {}, paymentMethod: 'Bank transfer' };
  const c2 = { ...ctx, rows: ctx.rows.concat(inv) };
  const o = { ...OCT, asOf: '2026-10-31' };
  const base = core.kpis(ctx, o), withInv = core.kpis(c2, o);
  assert.equal(withInv.revenueMtd, core.round2(base.revenueMtd + 3000));
  assert.equal(withInv.rolling12.turnover, core.round2(base.rolling12.turnover + 3000));
  assert.equal(withInv.ordersMtd, base.ordersMtd + 1);
  assert.equal(withInv.aov, base.aov);
  assert.equal(core.aovSeries(c2, { ...OCT, grain: 'month' }).current, core.aovSeries(ctx, { ...OCT, grain: 'month' }).current);
  assert.equal(core.revenueByChannel(c2, { ...OCT, grain: 'month' }).totals.club, core.round2(core.revenueByChannel(ctx, { ...OCT, grain: 'month' }).totals.club + 3000));
  assert.equal(core.funnel(c2, OCT).steps[4].users, core.funnel(ctx, OCT).steps[4].users);
  assert.equal(core.isSiteOrder(inv), false);
  assert.equal(core.isSiteOrder(ctx.rows[0]), true);
});
