// test/evri-match.test.mjs — lib/evri-match.cjs: CSV parsing, column
// detection without knowing Evri's format, matching rows to orders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import E from '../lib/evri-match.cjs';

const csv = fs.readFileSync(new URL('./fixtures/evri-tracking-sample.csv', import.meta.url), 'utf8');
const orders = [
  { id: 'pi_a', ref: 'Order #11111', name: 'Ann Smith', addr: { postal_code: 'BS1 1AA' } },
  { id: 'pi_b', ref: 'UCL CC #22222', name: 'Bob Jones', addr: { postal_code: 'WC1E 6BT' } },
  { id: 'pi_c', ref: 'Order #33333', name: 'Cat Brown', addr: { postal_code: 'BS8 1TH' }, dispatchedAt: '2026-11-20T00:00:00Z' },
  // two orders share #55555 (the number is a hash): the club prefix splits them
  { id: 'pi_e1', ref: 'Test University CC #55555', name: 'Fay Green', addr: { postal_code: 'CF5 2YB' } },
  { id: 'pi_e2', ref: 'Order #55555', name: 'Hal Blue', addr: { postal_code: 'N1 1AA' } },
  { id: 'bt_12345', ref: 'Test University CC #12345', payRef: 'PL-12345', name: 'Gus Grey', addr: { postal_code: 'CF5 2YB' } },
];

test('parseCSV: quotes, commas inside quotes, CRLF, BOM, blank lines', () => {
  const r = E.parseCSV('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2');
  assert.deepEqual(r, [['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]);
});

test('detectColumns: by header names', () => {
  const c = E.detectColumns(E.parseCSV(csv));
  assert.deepEqual(c, { header: true, track: 0, ref: 1, postcode: 4, last: 3 });
});

test('detectColumns: no header — tracking and reference found from the values', () => {
  const rows = E.parseCSV('Ann,Order #11111,H01ABC1234567890\nBob,UCL CC #22222,H01ABC1234567891');
  const c = E.detectColumns(rows);
  assert.equal(c.header, false); assert.equal(c.track, 2); assert.equal(c.ref, 1);
});

test('matchRows: match / already dispatched / unmatched / no tracking / club prefix + PL- refs', () => {
  const rows = E.parseCSV(csv);
  const m = E.matchRows(rows, E.detectColumns(rows), orders);
  const by = Object.fromEntries(m.map((x) => [x.ref, [x.status, x.order || null]]));
  assert.deepEqual(by['Order #11111'], ['match', 'pi_a']);
  assert.deepEqual(by['UCL CC #22222'], ['match', 'pi_b']);
  assert.deepEqual(by['Order #33333'], ['dispatched', 'pi_c']);
  assert.deepEqual(by['Order #99999'], ['unmatched', null]);
  assert.deepEqual(by['Order #44444'], ['no-tracking', null]);
  assert.deepEqual(by['Test University #55555'], ['match', 'pi_e1'], 'the (truncated) club prefix picks one of two #55555 orders');
  assert.deepEqual(by['PL-12345'], ['match', 'bt_12345'], 'bank-transfer pay ref');
  assert.equal(m[0].tracking, 'H01ABC1234567890'); assert.equal(m[0].line, 2);
});

test('matchRows: two orders, same number, no prefix → postcode decides, else ambiguous', () => {
  const two = [{ id: 'x1', ref: 'Order #77777', addr: { postal_code: 'AB1 2CD' } }, { id: 'x2', ref: 'Order #77777', addr: { postal_code: 'ZZ9 9ZZ' } }];
  const withPc = E.parseCSV('Tracking,Reference,Postcode\nH01ABC1234567000,#77777,zz9 9zz');
  assert.equal(E.matchRows(withPc, E.detectColumns(withPc), two)[0].order, 'x2');
  const noPc = E.parseCSV('Tracking,Reference\nH01ABC1234567000,#77777');
  const r = E.matchRows(noPc, E.detectColumns(noPc), two)[0];
  assert.equal(r.status, 'ambiguous'); assert.deepEqual(r.candidates, ['x1', 'x2']);
});
