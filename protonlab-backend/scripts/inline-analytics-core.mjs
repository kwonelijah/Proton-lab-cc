#!/usr/bin/env node
// scripts/inline-analytics-core.mjs — copy lib/analytics-core.cjs into the
// order dashboard between its ANALYTICS-CORE markers, so the dashboard stays a
// single offline-safe file while the maths has one tested source in this repo.
//   node scripts/inline-analytics-core.mjs [path/to/order-dashboard.html]
import fs from 'node:fs';
import path from 'node:path';

const dash = process.argv[2] || path.join(process.env.HOME || '', 'Desktop/Proton Dashboard/order-dashboard.html');
const src = fs.readFileSync(new URL('../lib/analytics-core.cjs', import.meta.url), 'utf8');
if (/<\/script/i.test(src) || /<!--/.test(src)) { console.error('refusing: the core contains </script> or <!--'); process.exit(1); }

const BEGIN = '/* ANALYTICS-CORE-BEGIN (generated from protonlab-backend/lib/analytics-core.cjs — edit there, then run scripts/inline-analytics-core.mjs) */';
const END = '/* ANALYTICS-CORE-END */';
let html = fs.readFileSync(dash, 'utf8');
const a = html.indexOf(BEGIN), b = html.indexOf(END);
if (a < 0 || b < 0 || b < a) { console.error(`markers not found in ${dash}`); process.exit(1); }
const before = html.slice(a + BEGIN.length, b);
html = html.slice(0, a + BEGIN.length) + '\n' + src.trim() + '\n' + html.slice(b);
fs.writeFileSync(dash, html);
console.log(`inlined ${src.length} chars into ${dash}${before.trim() === src.trim() ? ' (unchanged)' : ''}`);
