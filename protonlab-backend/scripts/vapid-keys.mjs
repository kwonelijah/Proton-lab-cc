// scripts/vapid-keys.mjs — make the Web Push key pair for the dashboard's
// notifications (lib/push.js). Run once, locally:
//   node scripts/vapid-keys.mjs
// then paste the three lines into Vercel → protonlab-backend → Settings →
// Environment Variables. Changing the keys later means every device has to
// switch notifications off and on again.
import crypto from 'node:crypto';
const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });   // d, x, y — always 32 bytes each
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
console.log(`VAPID_PUBLIC_KEY=${pub.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('VAPID_SUBJECT=mailto:info@protonlab.cc');
