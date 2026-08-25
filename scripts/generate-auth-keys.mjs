#!/usr/bin/env node
// One-time Convex Auth key setup (spec P3): generates a fresh RS256
// keypair and stores it on the target Convex deployment as
// JWT_PRIVATE_KEY + JWKS via `npx convex env set`.
//
// Usage:
//   node scripts/generate-auth-keys.mjs          # dev deployment
//   node scripts/generate-auth-keys.mjs --prod   # production deployment
//
// No secrets are read from or written to the repo.

import { execFileSync } from 'node:child_process';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const extraArgs = process.argv.slice(2); // e.g. --prod

const keys = await generateKeyPair('RS256', { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey))
  .trimEnd()
  .replace(/\n/g, ' ');
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] });

for (const [name, value] of [
  ['JWT_PRIVATE_KEY', privateKey],
  ['JWKS', jwks],
]) {
  execFileSync('npx', ['convex', 'env', 'set', ...extraArgs, name, value], {
    stdio: 'inherit',
  });
}
console.log('Convex Auth keys set.');
