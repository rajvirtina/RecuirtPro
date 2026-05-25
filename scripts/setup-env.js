/**
 * setup-env.js
 * Pre-start script: copies the persistent env file into backend/.env
 * so the server can read production secrets after a Git redeploy.
 *
 * Hostinger Git deployments wipe .builds/last-source on every push,
 * so .env (gitignored) disappears. This script checks:
 *   1. ~/recruitpro.env (home directory — persistent)
 *   2. ~/.recruitpro.env
 *   3. /home/recruitpro.env
 * and copies the first one found into backend/.env
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const target = path.resolve(__dirname, '..', 'backend', '.env');

// If backend/.env already exists, nothing to do
if (fs.existsSync(target)) {
  console.log('[setup-env] backend/.env already exists — skipping.');
  process.exit(0);
}

const candidates = [
  path.resolve(home, 'recruitpro.env'),
  path.resolve(home, '.recruitpro.env'),
  '/home/recruitpro.env',
  path.resolve(home, 'recruitpro', '.env'),
];

for (const src of candidates) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, target);
    console.log(`[setup-env] ✓ Copied ${src} → backend/.env`);
    process.exit(0);
  }
}

// Also check if .env.example exists and warn
const example = path.resolve(__dirname, '..', 'backend', '.env.example');
if (fs.existsSync(example)) {
  console.warn('[setup-env] ⚠ No persistent env file found. Copying .env.example → .env as fallback.');
  console.warn('[setup-env]   Create ~/recruitpro.env with production values to fix this permanently.');
  fs.copyFileSync(example, target);
} else {
  console.error('[setup-env] ✗ No .env file found anywhere! Server will likely crash.');
  console.error('[setup-env]   Create ~/recruitpro.env on the server with production values.');
}
