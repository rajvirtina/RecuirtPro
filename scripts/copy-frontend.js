/**
 * copy-frontend.js
 * Copies frontend/dist → backend/public so the Express production server
 * can serve the SPA directly (no separate frontend container needed on Hostinger).
 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'frontend', 'dist');
const dest = path.resolve(__dirname, '..', 'backend', 'public');

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) {
    console.warn(`[copy-frontend] Source not found: ${source} — skipping.`);
    return;
  }

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean destination first to avoid stale assets
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

copyRecursive(src, dest);

if (fs.existsSync(path.join(dest, 'index.html'))) {
  console.log('[copy-frontend] ✓ Frontend assets copied to backend/public/');
} else {
  console.warn('[copy-frontend] ⚠ index.html not found in destination — frontend may not have built correctly.');
}
