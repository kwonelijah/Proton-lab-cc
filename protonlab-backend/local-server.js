// Local dev server that wraps the Vercel function handlers so the Next.js
// frontend (and the order dashboard) can hit them without deploying:
// /api/create-checkout-session, /api/bank-transfer-order, /api/admin and
// /api/analytics.
//
// Run:  node protonlab-backend/local-server.js
// Then: set NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 in .env.local and
// restart `next dev`.
// LOCAL_MOCK_BLOB=1 swaps @vercel/blob for the in-memory test mock, so the
// bank-transfer flow runs end to end with no Blob store (orders vanish when
// the process exits). LOCAL_BACKEND_PORT picks the port (default 3001).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from the repo root into process.env.
function loadDotEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();
if (!process.env.SITE_URL) process.env.SITE_URL = 'http://localhost:3000';

// No sign-in on localhost (Elijah, 2026-11-26). This server only ever runs on
// the Mac and is never deployed, so the hosted dashboard keeps its login: every
// request here gets a session cookie for a local-only owner whose password hash
// can never match, and /login redirects to /dashboard. LOCAL_REQUIRE_LOGIN=1
// turns the real sign-in back on for testing it.
const LOCAL_NO_LOGIN = process.env.LOCAL_REQUIRE_LOGIN !== '1';
const LOCAL_USER = { u: 'local', role: 'owner', sv: 1 };
if (LOCAL_NO_LOGIN) {
  if ((process.env.SESSION_SECRET || '').length < 32) {
    process.env.SESSION_SECRET = (await import('node:crypto')).randomBytes(32).toString('hex');
  }
  let users = [];
  try { users = JSON.parse(process.env.DASHBOARD_USERS || '[]'); } catch { users = []; }
  if (!Array.isArray(users)) users = [];
  if (!users.some((x) => x && x.u === LOCAL_USER.u)) users.push({ ...LOCAL_USER, hash: 'local-no-login' });
  process.env.DASHBOARD_USERS = JSON.stringify(users);
  console.log('Dashboard sign-in: OFF on localhost (LOCAL_REQUIRE_LOGIN=1 to turn it on)');
}
if (process.env.LOCAL_MOCK_BLOB === '1') {
  register('./test/hooks-blob.mjs', import.meta.url);
  if (!process.env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = 'local-mock';
  console.log('Blob store: in-memory mock (LOCAL_MOCK_BLOB=1)');
}

const { default: checkoutHandler } = await import('./api/create-checkout-session.js');
const { default: bankOrderHandler } = await import('./api/bank-transfer-order.js');
const { default: adminHandler } = await import('./api/admin.js');
const { default: analyticsHandler } = await import('./api/analytics.js');
const { makeSessionToken, COOKIE } = await import('./lib/auth.js');

// Replace any pl_session cookie on the request with a fresh local-owner one.
function signInLocally(req) {
  const others = String(req.headers.cookie || '').split(';').map((s) => s.trim())
    .filter((s) => s && !s.startsWith(COOKIE + '='));
  req.headers.cookie = [...others, `${COOKIE}=${makeSessionToken(LOCAL_USER)}`].join('; ');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      // Like Vercel: JSON → object; anything else (e.g. a document upload) → Buffer.
      if (!/json/i.test(String(req.headers['content-type'] || 'application/json'))) return resolve(buf);
      if (!buf.length) return resolve({});
      try { resolve(JSON.parse(buf.toString('utf8'))); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Patch res to match the small Express-ish shape the handler uses.
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

// Allow local dev origins through CORS regardless of the handler's hard-coded value.
function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = ['https://protonlab.cc'];
  if (origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // No/other origin (e.g. the order dashboard opened from file://, whose
    // Origin is "null") — the real admin/analytics handlers answer `*` too.
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PL');
  res.setHeader('Vary', 'Origin');
}

const PORT = Number(process.env.LOCAL_BACKEND_PORT || 3001);

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const routes = {
    '/api/create-checkout-session': checkoutHandler,
    '/api/bank-transfer-order': bankOrderHandler,
    '/api/admin': adminHandler,
    '/api/analytics': analyticsHandler,
  };

  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, endpoints: Object.keys(routes), mockBlob: process.env.LOCAL_MOCK_BLOB === '1' }));
  }

  // Hosted-dashboard rewrites (mirror vercel.json).
  const VIEWS = { '/dashboard': 'app', '/login': 'login', '/sw.js': 'sw', '/sync-layer.js': 'sync', '/today.js': 'today', '/evri-match.js': 'evri', '/manifest.json': 'manifest', '/icon.png': 'icon' };
  if (url.pathname === '/' || (LOCAL_NO_LOGIN && url.pathname === '/login')) {
    res.statusCode = 302; res.setHeader('Location', '/dashboard'); return res.end();
  }
  if (LOCAL_NO_LOGIN) signInLocally(req);
  const view = VIEWS[url.pathname];
  if (view) url.searchParams.set('view', view);

  const handler = view ? adminHandler : routes[url.pathname];
  if (handler) {
    req.query = Object.fromEntries(url.searchParams.entries());
    if (req.method === 'POST') {
      try {
        req.body = await readBody(req);
      } catch (err) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    }
    // The handlers set their own Access-Control-Allow-Origin (protonlab.cc / *).
    // Intercept setHeader so our local-origin CORS value isn't overwritten.
    const origSet = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      if (name.toLowerCase() === 'access-control-allow-origin') return res;
      return origSet(name, value);
    };
    const wrapped = wrapRes(res);
    wrapped.send = (body) => { res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); return wrapped; };
    return handler(req, wrapped);
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Local backend listening on http://localhost:${PORT} (checkout, bank-transfer-order, admin, analytics)`);
  console.log('Health: curl http://localhost:' + PORT + '/health');
  console.log('Set NEXT_PUBLIC_BACKEND_URL=http://localhost:' + PORT + ' in .env.local and restart next dev.');
});
