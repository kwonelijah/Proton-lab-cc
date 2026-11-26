// test/weekly.test.mjs — lib/weekly-summary.js renders from fixtures; the
// send is always stubbed (no real email in tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklySummary, sendWeeklySummary, weeks } from '../lib/weekly-summary.js';
import T from '../lib/today.cjs';

const NOW = new Date('2026-11-30T07:00:00Z');   // a Monday
const feed = {
  awaiting: [
    { id: 'a', date: '2026-11-24T10:00:00Z', amount: '100.00', symbol: '£', club: '' },
    { id: 'b', date: '2026-11-25T10:00:00Z', amount: '50.00', symbol: '£', club: 'UCL CC', clubHandle: 'ucl' },
    { id: 'bt', date: '2026-11-26T10:00:00Z', amount: '45.00', symbol: '£', club: 'UCL CC', clubHandle: 'ucl', payment: 'bank-transfer', paid: false, payBy: '2026-12-03' },
    { id: 'e', date: '2026-11-27T10:00:00Z', amount: '60.00', symbol: '€', club: '' },
    { id: 'old', date: '2026-11-18T10:00:00Z', amount: '80.00', symbol: '£', club: '' },
    { id: 'thisweek', date: '2026-11-30T06:00:00Z', amount: '999.00', symbol: '£', club: '' },
  ],
  dispatched: [],
};
const state = { sections: { orders: { data: [
  { id: 'p1', club: 'Bath <script>CC', stage: 'design', value: 900, updated: '2026-11-29', next: 'Send <b>mockup</b>', nextDate: '2026-11-28' },
  { id: 'p2', club: 'Dundee CC', stage: 'delivered', value: 640, deliveredDate: '2026-11-26' },
] } } };
const clubs = [{ handle: 'ucl', name: 'UCL CC', windowStart: '2026-11-20', windowEnd: '2026-12-05' }];

test('weeks: last Monday–Sunday and the week before (UTC)', () => {
  assert.deepEqual(weeks(NOW), { last: { from: '2026-11-23', to: '2026-11-29' }, prev: { from: '2026-11-16', to: '2026-11-22' } });
  assert.deepEqual(weeks(new Date('2026-12-02T12:00:00Z')).last, { from: '2026-11-23', to: '2026-11-29' });
});

test('summary: revenue split, comparison, pipeline, windows, unpaid, low stock — and HTML-escaped', () => {
  const today = T.todayItems({ orders: state.sections.orders.data, feed, clubs }, NOW);
  const m = buildWeeklySummary({ state, feed, clubs, today, stock: [{ handle: 'sunset-jersey', size: 'M', quantity: 1 }, { handle: 'x', size: 'L', quantity: 9 }] }, NOW);
  assert.equal(m.subject, 'Proton weekly — £195.00 from 4 orders (23 Nov – 29 Nov)');
  assert.match(m.html, /£195\.00 \+ €60\.00/);
  assert.match(m.html, /\+144% vs week before/);
  assert.match(m.html, /£100\.00 · £95\.00/, 'retail · club');
  assert.match(m.html, /Of which bank transfer/);
  assert.match(m.html, /Design<\/td>[\s\S]*1 · £900\.00/);
  assert.match(m.html, /Completed last week[\s\S]*1 · Dundee CC/);
  assert.match(m.html, /<b>UCL CC<\/b> — closes 5 Dec · 2 orders so far/);
  assert.match(m.html, /1 order · £45\.00 outstanding/);
  assert.match(m.html, /sunset-jersey <b>M<\/b>: 1/);
  assert.doesNotMatch(m.html, /<script>/, 'club names are escaped');
  assert.match(m.html, /<b>Bath &lt;script&gt;CC<\/b> — Send &lt;b&gt;mockup&lt;\/b&gt; · overdue/);
  assert.match(m.text, /^Proton weekly — 23 Nov – 29 Nov\nRevenue £195\.00/);
});

test('missing feed / stock are reported, not fatal', () => {
  const m = buildWeeklySummary({ state, feed: null, clubs: null, today: null, stock: null }, NOW);
  assert.match(m.html, /order feed could not be read/);
  assert.match(m.html, /Stock file unavailable/);
});

test('send: dry run never sends; stubbed send gets the message; errors are returned, not thrown', async () => {
  const dry = await sendWeeklySummary({ state, feed, clubs, today: null, now: NOW, dryRun: true });
  assert.equal(dry.sent, false); assert.ok(dry.html.includes('Proton') || dry.html.length > 100);
  assert.equal(dry.to, 'info@protonlab.cc');
  const got = [];
  const ok = await sendWeeklySummary({ state, feed, clubs, today: null, now: NOW, sendImpl: async (m) => { got.push(m); return { data: { id: 'x' } }; } });
  assert.equal(ok.sent, true);
  assert.equal(got[0].to, 'info@protonlab.cc');
  assert.equal(got[0].from, 'Proton Lab CC <noreply@protonlab.cc>');
  const bad = await sendWeeklySummary({ state, feed, clubs, today: null, now: NOW, sendImpl: async () => { throw new Error('boom'); } });
  assert.deepEqual([bad.sent, bad.error], [false, 'boom']);
});
