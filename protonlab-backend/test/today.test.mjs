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
  assert.match(next[0].sub, /^Chase · overdue, 2 days ago$/);
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
  assert.match(w[0].sub, /closes tomorrow .* · 1 order so far/);
  assert.equal(w[0].target.type, 'club');
});

test('unpaid bank transfers: past pay-by (high) or older than 5 days (mid); paid / recent ignored', () => {
  const feed = { awaiting: [
    { id: 'bt_1', payment: 'bank-transfer', paid: false, date: '2026-11-15T00:00:00Z', payBy: '2026-11-22T00:00:00Z', amount: '90.00', ref: 'UCL #1', name: 'A', payRef: 'PL-1' },
    { id: 'bt_2', payment: 'bank-transfer', paid: false, date: '2026-11-19T00:00:00Z', payBy: '2026-11-30T00:00:00Z', amount: '45.00' },
    { id: 'bt_3', payment: 'bank-transfer', paid: false, date: '2026-11-25T00:00:00Z', payBy: '2026-12-02T00:00:00Z' },
    { id: 'bt_4', payment: 'bank-transfer', paid: true, date: '2026-11-01T00:00:00Z' },
  ], dispatched: [] };
  const u = T.todayItems({ feed }, NOW).sections.find((s) => s.key === 'unpaid').items;
  assert.deepEqual(u.map((x) => [x.id, x.severity]), [['bt_1', 'high'], ['bt_2', 'mid']]);
  assert.match(u[0].sub, /£90\.00 · PL-1 · pay-by date passed/);
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
