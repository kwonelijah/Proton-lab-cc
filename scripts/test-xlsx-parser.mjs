// scripts/test-xlsx-parser.mjs — dev-only, not part of the build.
// Verifies the order dashboard's built-in .xlsx order-form parser against
// every real order form on disk. The parser lives inside the dashboard HTML
// between /* XLSX-PARSER-BEGIN */ and /* XLSX-PARSER-END */ markers — this
// harness extracts that exact block and runs it in Node (needs Node >= 21.2
// for DecompressionStream). Run:  node scripts/test-xlsx-parser.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DASH = '/Users/elijahkwon/Desktop/Proton Dashboard/order-dashboard.html';
const FORMS_DIR = '/Users/elijahkwon/Desktop/Proton /Custom Orders';

const html = readFileSync(DASH, 'utf8');
const m = html.match(/\/\* XLSX-PARSER-BEGIN[\s\S]*?XLSX-PARSER-END \*\//);
if (!m) {
  console.error('Parser markers not found in the dashboard HTML');
  process.exit(2);
}
const { parseOrderForm } = new Function(m[0] + '\nreturn { parseOrderForm };')();

function findForms(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...findForms(p));
    else if (/order form.*\.xlsx$/i.test(name) && !name.startsWith('~$')) out.push(p);
  }
  return out;
}

const files = findForms(FORMS_DIR).sort();
console.log(`Found ${files.length} order forms under ${FORMS_DIR}\n`);

let pass = 0, fail = 0, empty = 0;
for (const file of files) {
  const short = file.slice(FORMS_DIR.length + 1);
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  try {
    const r = await parseOrderForm(ab);
    const units = r.rows.reduce((s, x) => s + x.sizes.reduce((a, b) => a + b.qty, 0), 0);
    console.log(`PASS  ${short}`);
    console.log(`      header row ${r.headerRow} · size cols ${r.sizeCols.join(' ')}`);
    for (const row of r.rows) {
      const sz = row.sizes.map((s) => `${s.gender ? s.gender[0] + ':' : ''}${s.size}×${s.qty}`).join(' ');
      console.log(`      ${row.product}${row.colourway ? ` [${row.colourway}]` : ''} — ${sz} (total ${row.totalPcs})`);
    }
    for (const w of r.warnings) console.log(`      ⚠ ${w}`);
    console.log(`      = ${units} units\n`);
    pass++;
  } catch (e) {
    if (/No item rows with quantities/.test(String(e.message))) {
      // A blank/template form — the dashboard correctly refuses it too.
      console.log(`EMPTY ${short} (${e.message})\n`);
      empty++;
    } else {
      console.log(`FAIL  ${short}\n      ${e.message}\n`);
      fail++;
    }
  }
}
console.log(`${pass} parsed, ${empty} empty templates, ${fail} failed, of ${files.length} files`);
process.exit(fail ? 1 : 0);
