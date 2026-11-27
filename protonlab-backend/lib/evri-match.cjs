/* lib/evri-match.cjs — read a tracking CSV downloaded from Evri and match its
   rows to dashboard orders (2026-11-27). Pure; served to the dashboard at
   /evri-match.js (window.PLEvri) and unit-tested in test/evri-match.test.mjs.

   Evri's export format isn't known yet, so the columns are detected, not
   assumed:
     tracking  a header like "Tracking", "Barcode", "Parcel number",
               "Consignment" — or else the column whose values look like a
               parcel code (12–20 letters/digits, with digits)
     reference a header like "Reference" / "Customer ref" / "Order" — or else
               the column whose values carry an order number (#12345 / PL-12345),
               which is what the dashboard's Evri CSV puts in Reference
     postcode, last name (optional) — used to split two orders that share a
               5-digit number (the number is a hash of the payment id)

   parseCSV(text) → rows (arrays of strings)
   detectColumns(rows) → {header, track, ref, postcode, last} (indexes, -1 = none)
   matchRows(rows, cols, orders) → [{line, tracking, ref, status, order?, candidates?}]
     status: 'match' | 'dispatched' (already) | 'unmatched' | 'ambiguous' | 'no-tracking' */
(function (root) {
  'use strict';

  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
    return rows;
  }

  const H_TRACK = /track|barcode|parcel\s*(no|num|number|id|code)|consignment/i;
  const H_REF = /ref|order|customer\s*ref/i;
  const H_POST = /post\s*code|postcode|zip/i;
  const H_LAST = /last\s*name|surname|recipient|name/i;
  const V_TRACK = /^(?=.*\d)[A-Z0-9]{12,20}$/i;
  const V_REF = /#\s?\d{5}\b|\bPL-\d{5}\b/i;

  function detectColumns(rows) {
    const first = rows[0] || [];
    const isHeader = first.some((c) => H_TRACK.test(c) || /^ref|reference/i.test(c)) && !first.some((c) => V_REF.test(c));
    const body = isHeader ? rows.slice(1) : rows;
    const width = Math.max(0, ...rows.map((r) => r.length));
    const share = (j, re) => { const v = body.map((r) => r[j] || '').filter(Boolean); return v.length ? v.filter((x) => re.test(x)).length / v.length : 0; };
    const byHeader = (re, not = []) => (isHeader ? first.findIndex((c, j) => re.test(c) && !not.includes(j)) : -1);
    const best = (re, not = []) => { let bi = -1, bs = 0; for (let j = 0; j < width; j++) { if (not.includes(j)) continue; const s = share(j, re); if (s > bs) { bs = s; bi = j; } } return bs >= 0.5 ? bi : -1; };
    let track = byHeader(H_TRACK);
    if (track === -1) track = best(V_TRACK);
    let ref = byHeader(/^(customer\s*)?ref(erence)?\b|^reference/i, [track]);
    if (ref === -1 || share(ref, V_REF) < 0.3) { const v = best(V_REF, [track]); if (v !== -1) ref = v; }
    if (ref === -1) ref = byHeader(H_REF, [track]);
    const postcode = byHeader(H_POST, [track, ref]);
    const last = isHeader ? first.findIndex((c, j) => /last\s*name|surname/i.test(c) && ![track, ref].includes(j)) : -1;
    return { header: isHeader, track, ref, postcode, last };
  }

  const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const numberOf = (ref) => { const m = /#\s?(\d{5})\b/.exec(ref || '') || /\bPL-(\d{5})\b/i.exec(ref || ''); return m ? m[1] : null; };
  const prefixOf = (ref) => { const i = String(ref || '').indexOf('#'); return i > 0 ? ref.slice(0, i).trim().toLowerCase() : ''; };

  function matchRows(rows, cols, orders) {
    orders = Array.isArray(orders) ? orders : [];
    const body = cols.header ? rows.slice(1) : rows;
    return body.map((r, i) => {
      const tracking = cols.track >= 0 ? norm(r[cols.track]) : '';
      const ref = cols.ref >= 0 ? (r[cols.ref] || '') : '';
      const out = { line: i + (cols.header ? 2 : 1), tracking, ref };
      if (!tracking) return { ...out, status: 'no-tracking' };
      const num = numberOf(ref);
      if (!num) return { ...out, status: 'unmatched' };
      let c = orders.filter((o) => numberOf(o.ref) === num || (o.payRef && o.payRef.toUpperCase() === 'PL-' + num));
      const pre = prefixOf(ref);
      if (c.length > 1 && pre) { const f = c.filter((o) => String(o.ref || '').toLowerCase().startsWith(pre)); if (f.length) c = f; }
      if (c.length > 1 && cols.postcode >= 0) { const pc = norm(r[cols.postcode]); const f = c.filter((o) => norm(o.addr && o.addr.postal_code) === pc); if (f.length) c = f; }
      if (c.length > 1 && cols.last >= 0) { const ln = String(r[cols.last] || '').trim().toLowerCase(); const f = c.filter((o) => String(o.name || '').toLowerCase().split(/\s+/).pop() === ln); if (f.length) c = f; }
      if (!c.length) return { ...out, status: 'unmatched' };
      if (c.length > 1) return { ...out, status: 'ambiguous', candidates: c.map((o) => o.id) };
      const o = c[0];
      return { ...out, status: o.dispatchedAt ? 'dispatched' : 'match', order: o.id };
    });
  }

  const api = { parseCSV, detectColumns, matchRows, numberOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PLEvri = api;
})(typeof self !== 'undefined' ? self : this);
