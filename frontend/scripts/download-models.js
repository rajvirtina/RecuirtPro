/**
 * download-models.js
 * Downloads TinyFaceDetector model weights for face-api.js proctoring.
 * Run automatically via `npm install` (postinstall hook) or manually with:
 *   node scripts/download-models.js
 *
 * Skips files that already exist so re-runs are safe and fast.
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { get } from 'https';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL =
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const MODEL_DIR = resolve(__dirname, '../public/models');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) {
      console.log(`  ✓ already exists — ${dest.split(/[\\/]/).slice(-2).join('/')}`);
      return resolve();
    }
    const file = createWriteStream(dest);
    get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Only download when proctoring is enabled, or force with --force flag
  const force = process.argv.includes('--force');
  const enabled = process.env.VITE_ENABLE_PROCTORING === 'true';
  if (!enabled && !force) {
    console.log('[models] VITE_ENABLE_PROCTORING is not "true" — skipping model download.');
    console.log('         Run with --force or set VITE_ENABLE_PROCTORING=true to download.');
    return;
  }

  mkdirSync(MODEL_DIR, { recursive: true });
  console.log('[models] Downloading TinyFaceDetector weights →', MODEL_DIR);

  for (const file of FILES) {
    const url  = `${BASE_URL}/${file}`;
    const dest = join(MODEL_DIR, file);
    try {
      process.stdout.write(`  ↓ ${file} … `);
      await download(url, dest);
      if (!existsSync(dest) || true) process.stdout.write('done\n');
    } catch (err) {
      process.stdout.write('\n');
      console.error(`  ✗ Failed: ${err.message}`);
      console.error('    Face detection will be gracefully disabled until models are present.');
    }
  }

  console.log('[models] Done.');
}

main().catch((err) => {
  console.error('[models] Unexpected error:', err);
  // Do not exit with non-zero code — don't block npm install
});
