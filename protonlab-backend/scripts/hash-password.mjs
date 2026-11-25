// scripts/hash-password.mjs
// Makes a DASHBOARD_USERS entry for the hosted order dashboard. Runs locally;
// the password is read without echo and never written anywhere.
//
//   node scripts/hash-password.mjs            → prompts for username + password
//   node scripts/hash-password.mjs --secret   → also prints a fresh SESSION_SECRET
//
// Paste the printed JSON into Vercel → protonlab-backend → Settings →
// Environment Variables → DASHBOARD_USERS (a JSON array; add more users later
// by appending entries). Bump a user's "sv" to sign them out everywhere.

import crypto from 'node:crypto';
import readline from 'node:readline';
import { hashPassword } from '../lib/auth.js';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const u = (await ask('Username: ')).trim() || 'elijah';
const pw = await ask('Password (min 12 characters): ', true);
if (pw.length < 12) {
  console.error('Password too short — use at least 12 characters.');
  process.exit(1);
}
const pw2 = await ask('Repeat password: ', true);
if (pw !== pw2) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const entry = { u, hash: await hashPassword(pw), role: 'owner', sv: 1 };
console.log('\nDASHBOARD_USERS =');
console.log(JSON.stringify([entry]));
if (process.argv.includes('--secret')) {
  console.log('\nSESSION_SECRET =');
  console.log(crypto.randomBytes(48).toString('base64url'));
}
