// lib/clubs.js
// Club-shop access details for the order dashboard. Reads data/clubs.ts from
// the website repo — the file the club gate itself uses (the gate runs
// client-side, so these passwords already ship in the site's JS bundle; this
// just saves opening the repo to look one up). Hand-maintained data with a
// fixed shape, so a regex over the club-level handle/name/password triplet is
// enough: product entries list name before handle and carry no password, so
// they never match. A club added to the website shows up on the dashboard
// with no dashboard change.

import { readRepoFile } from './stock.js';

const CLUBS_PATH = 'data/clubs.ts';
const SITE_URL = 'https://protonlab.cc';
const CLUB_RE = /handle:\s*(['"])(.*?)\1,\s*name:\s*(['"])(.*?)\3,\s*password:\s*(['"])(.*?)\5/g;
const unescape = (s) => s.replace(/\\(['"])/g, '$1');

export function parseClubs(source) {
  const src = String(source);
  const clubs = [];
  for (const m of src.matchAll(CLUB_RE)) {
    const handle = unescape(m[2]);
    // The club's header block runs from the triplet to its products array —
    // windowStart/windowEnd (ISO dates) live there when the shop has a
    // declared order window; the dashboard seeds its window from them.
    const headEnd = src.indexOf('products:', m.index);
    const head = src.slice(m.index, headEnd === -1 ? m.index + 1500 : headEnd);
    const win = (f) => (head.match(new RegExp(`${f}:\\s*(['"])(\\d{4}-\\d{2}-\\d{2})\\1`)) || [])[2] || null;
    clubs.push({
      handle,
      name: unescape(m[4]),
      password: unescape(m[6]),
      url: `${SITE_URL}/custom/club/${handle}`,
      windowStart: win('windowStart'),
      windowEnd: win('windowEnd'),
    });
  }
  return clubs;
}

export async function readClubs() {
  const { text, sha } = await readRepoFile(CLUBS_PATH);
  const clubs = parseClubs(text);
  if (!clubs.length) throw new Error('CLUBS_PARSE_FAILED: no clubs matched in data/clubs.ts');
  return { clubs, sha, gateUrl: `${SITE_URL}/custom/club` };
}
