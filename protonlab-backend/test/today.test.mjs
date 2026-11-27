// test/today.test.mjs — lib/today.cjs, the rules behind the Today screen and
// the morning push digest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import T from '../lib/today.cjs';

const NOW = new Date('2026-11-26T09:00:00Z');
const order = (o) => ({ id: o.id, club: o.club || o.id, stage: 'discuss', updated: '2026-11-25', ...o });

test('next steps: overdue first (high), due today (mid), within 2 days (low); later + delivered ignored', () => {
  const r = T.todayItems({ orders: [
    order({ id: 'a', next: 'Chase', nextDate: '2026-11-24' }),
    order({ id: 'b', nextDate: '2026-11-26' }),
    order({ id: 'c', nextDate: '2026-11-28' }),
    order({ id: 'd', nextDate: '2026-11-30' }),
    order({ id: 'e', nextDate: '2026-11-20', stage: 'delivered' }),
  ] }, NOW);
  const next = r.sections.find((s) => s.key === 'next').items;
  assert.deepEqual(next.map((x) => [x.id, x.severity]), [['a', 'high'], ['b', 'mid'], ['c', 'low']]);
  assert.match(next[0].sub, /^Chase · overdue since \d{2}\/\d{2}\/\d{4}$/);
  assert.equal(r.counts.overdue, 1);
});

test('windows closing within 3 days, from local windows and clubs.ts, with order counts', () => {
  const feed = { awaiting: [{ id: 'p1', clubHandle: 'ucl', date: '2026-11-22T10:00:00Z' }, { id: 'p2', clubHandle: 'ucl', date: '2026-11-01T10:00:00Z' }], dispatched: [] };
  const r = T.todayItems({
    feed,
    clubs: [{ handle: 'ucl', name: 'UCL CC' }, { handle: 'bath', name: 'Bath CC', windowStart: '2026-11-10', windowEnd: '2026-11-29' }, { handle: 'far', name: 'Far CC', windowEnd: '2026-12-20' }],
    windows: { ucl: [{ id: 'w', start: '2026-11-20', end: '2026-11-27' }], old: [{ end: '2026-11-01' }] },
  }, NOW);
  const w = r.sections.find((s) => s.key === 'windows').items;
  assert.deepEqual(w.map((x) => x.title), ['UCL CC', 'Bath CC']);
  assert.match(w[0].sub, /closes \d{2}\/\d{2}\/\d{4} · 1 order so far/);
  assert.equal(w[0].target.type, 'club');
});

test('unpaid bank transfers: past pay-by (high) or older than 5 days (mid); paid / recent ignored', () => {
  const feed = { awaiting: [
    { id: 'bt_1', payment: 'bank-transfer', paid: false, date: '2026-11-15T00:00:00Z', payBy: '2026-11-22T00:00:00Z', amount: '90.00', ref: 'UCL #1', name: 'A', payRef: 'PL-1' },
    { id: 'bt_2', payment: 'bank-transfer', paid: false, date: '2026-11-19T00:00:00Z', payBy: '2026-11-30T00:00:00Z', amount: '45.00' },
    { id: 'bt_3', payment: 'bank-transfer', paid: false, date: '2026-11-25T00:00:00Z', payBy: '2026-12-02T00:00:00Z' },
    { id: 'bt_4', payment: 'bank-transfer', paid: true, date: '2026-11-01T00:00:00Z' },
  ], dispatched: [] };
  const secs = T.todayItems({ feed }, NOW).sections;
  const late = secs.find((s) => s.key === 'unpaid').items, waiting = secs.find((s) => s.key === 'awaiting').items;
  assert.deepEqual(late.map((x) => [x.id, x.severity]), [['bt_1', 'high']], 'past pay-by → Overdue bank transfers');
  assert.deepEqual(waiting.map((x) => [x.id, x.severity]), [['bt_2', 'mid']], 'older than 5 days, still in time → Awaiting payment');
  assert.match(late[0].sub, /pay-by \d{2}\/\d{2}\/\d{4} passed/);
  assert.equal(late[0].sub, "£90.00 · PL-1 · pay-by 22/11/2026 passed");
});

test('ready to dispatch: grouped retail first then clubs; unpaid transfers and dispatched manual orders excluded', () => {
  const feed = { awaiting: [
    { id: 's1', club: '', date: '2026-11-20T00:00:00Z' },
    { id: 's2', club: 'Proton Lab', date: '2026-11-25T00:00:00Z' },
    { id: 'c1', club: 'UCL CC', clubHandle: 'ucl', date: '2026-11-24T00:00:00Z' },
    { id: 'bt', club: 'UCL CC', clubHandle: 'ucl', payment: 'bank-transfer', paid: false, date: '2026-11-25T00:00:00Z' },
  ], dispatched: [] };
  const manual = [{ id: 'm1', manual: true, club: '', date: '2026-11-25' }, { id: 'm2', manual: true, dispatchedAt: 'x' }];
  const r = T.todayItems({ feed, manual }, NOW);
  const d = r.sections.find((s) => s.key === 'dispatch').items;
  assert.deepEqual(d.map((x) => [x.title, x.sub.split(' · ')[0]]), [['Retail (web shop)', '3 orders to dispatch'], ['UCL CC', '1 order to dispatch']]);
  assert.equal(d[0].severity, 'mid', 'retail order waiting 6 days');
  assert.equal(r.counts.dispatch, 4);
});

test('stalled: no change for >14 days, except production / delivery / delivered', () => {
  const r = T.todayItems({ orders: [
    order({ id: 's', updated: '2026-11-01', stage: 'design' }),
    order({ id: 'p', updated: '2026-10-01', stage: 'production' }),
    order({ id: 'f', updated: '2026-11-20' }),
  ] }, NOW);
  assert.deepEqual(r.sections.find((x) => x.key === 'stalled').items.map((x) => x.id), ['s']);
});

test('summary line and all-clear; missing feed is tolerated', () => {
  assert.equal(T.todayItems({}, NOW).summary, 'All clear');
  const r = T.todayItems({ orders: [order({ id: 'a', nextDate: '2026-11-25' })], feed: null }, NOW);
  assert.equal(r.summary, '1 overdue');
  assert.equal(r.total, 1);
});

test('money owed: invoiced custom-kit deals with no paid date; paid / zero / deleted ignored', () => {
  const orders = [
    { id: 'a', club: 'Bath CC', paidVia: 'invoice', invoiceAmount: '1200.00', invoiceNo: '00035', invoiceSentDate: '2026-11-01' },
    { id: 'b', club: 'Paid CC', paidVia: 'invoice', invoiceAmount: '500', invoicePaidDate: '2026-11-02' },
    { id: 'c', club: 'Zero CC', paidVia: 'invoice', invoiceAmount: '0' },
    { id: 'd', club: 'Stripe CC', paidVia: 'stripe', invoiceAmount: '300' },
    { id: 'e', club: 'Gone CC', paidVia: 'invoice', invoiceAmount: '90', deleted: true },
  ];
  const owed = T.todayItems({ orders }, NOW).sections.find((s) => s.key === 'owed').items;
  assert.deepEqual(owed.map((x) => x.target.id), ['a']);
  assert.equal(owed[0].sub, '£1,200.00 · invoice 00035 · sent 01/11/2026');
});

test('refunds to receive back: full refunds not yet returned; dates dd/mm/yyyy', () => {
  const feed = { awaiting: [], dispatched: [], refunded: [
    { id: 'pi_r1', ref: 'Order #11111', name: 'Ann', refundedAmount: '45.00', refundedAt: '2026-11-20T10:00:00Z' },
    { id: 'pi_r2', ref: 'Order #22222', name: 'Bob', refundedAmount: '30.00', returnedAt: '2026-11-21T10:00:00Z' },
  ] };
  const r = T.todayItems({ feed }, NOW);
  const items = r.sections.find((s) => s.key === 'returns').items;
  assert.deepEqual(items.map((x) => x.target), [{ type: 'refund', id: 'pi_r1' }]);
  assert.equal(items[0].sub, 'Refunded £45.00 on 20/11/2026 · awaiting return');
  assert.match(r.summary, /1 return due back/);
});

test('invoices to link: unmatched Mac uploads appear with the amount', () => {
  const r = T.todayItems({ unmatchedInvoices: [{ no: '00036', total: 640, client: 'Hup CC' }] }, NOW);
  const it = r.sections.find((s) => s.key === 'invoices').items[0];
  assert.equal(it.title, 'Invoice 00036 · Hup CC');
  assert.equal(it.sub, '£640.00 · choose the deal');
  assert.deepEqual(it.target, { type: 'invoice', id: '00036' });
});

test('no relative date words anywhere', () => {
  const orders = [{ id: 'x', club: 'A', stage: 'discuss', next: 'Call', nextDate: NOW.toISOString().slice(0, 10), updated: '2026-01-01' }];
  const text = JSON.stringify(T.todayItems({ orders }, NOW));
  assert.ok(!/\b(today|tomorrow|yesterday|days ago|in \d+ days)\b/.test(text), text);
});
