// Local dev server that wraps the Vercel function handlers so the Next.js
// frontend can hit the new checkout endpoint without deploying.
//
// Run:  node protonlab-backend/local-server.js
// Then: set NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 in .env.local and
// restart `next dev`.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const { default: checkoutHandler } = await import('./api/create-checkout-session.js');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
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
  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://protonlab.cc'];
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

const PORT = Number(process.env.LOCAL_BACKEND_PORT || 3001);

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, endpoint: '/api/create-checkout-session' }));
  }

  if (req.url === '/api/create-checkout-session' && req.method === 'POST') {
    try {
      req.body = await readBody(req);
    } catch (err) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    // The handler sets its own Access-Control-Allow-Origin (protonlab.cc). Intercept
    // setHeader so our local-origin CORS value isn't overwritten.
    const origSet = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      if (name.toLowerCase() === 'access-control-allow-origin') return res;
      return origSet(name, value);
    };
    return checkoutHandler(req, wrapRes(res));
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Local checkout backend listening on http://localhost:${PORT}`);
  console.log('Health: curl http://localhost:' + PORT + '/health');
  console.log('Set NEXT_PUBLIC_BACKEND_URL=http://localhost:' + PORT + ' in .env.local and restart next dev.');
});
