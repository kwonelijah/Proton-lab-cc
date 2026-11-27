// scripts/mac/lib.mjs — shared bits for the Mac helpers: the dashboard URL,
// the Mac key from the macOS Keychain (never stored in a file), a log line.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
export const BASE = (process.env.PROTON_DASHBOARD_URL || 'https://protonlab-backend.vercel.app').replace(/\/$/, '');
export const KEYCHAIN_SERVICE = 'proton-dashboard-mac';

export function macKey() {
  if (process.env.PROTON_MAC_KEY) return process.env.PROTON_MAC_KEY;   // tests / one-off runs
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`No Mac key in the Keychain (service "${KEYCHAIN_SERVICE}") — run scripts/mac/install.sh`);
  }
}

export function logger(name) {
  const file = path.join(HOME, 'Library', 'Logs', `${name}.log`);
  return (...parts) => {
    const line = `${new Date().toISOString()} ${parts.join(' ')}`;
    console.log(line);
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, line + '\n'); } catch { /* logging never breaks the job */ }
  };
}

export async function api(pathAndQuery, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE}/api/admin${pathAndQuery}`, { method, headers: { authorization: `Bearer ${macKey()}`, ...headers }, body });
  return res;
}
