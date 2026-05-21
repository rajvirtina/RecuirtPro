<# 
  RecuirtPro — Hostinger Node.js Deployment Script
  Run this LOCALLY before uploading to Hostinger.
  Produces a clean /deploy folder ready to zip and upload.
#>

param(
  [switch]$SkipFrontend,
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$DEPLOY = Join-Path $ROOT "deploy"

Write-Host "`n=== RecuirtPro Hostinger Deploy Builder ===" -ForegroundColor Cyan

# ── Step 1: Clean previous deploy folder ──────────────────────
if (Test-Path $DEPLOY) { Remove-Item $DEPLOY -Recurse -Force }
New-Item -ItemType Directory -Path $DEPLOY | Out-Null

# ── Step 2: Build Frontend ────────────────────────────────────
if (-not $SkipFrontend) {
  Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
  Push-Location (Join-Path $ROOT "frontend")
  npm ci --prefer-offline 2>$null
  npm run build
  Pop-Location
  Write-Host "  ✓ Frontend built" -ForegroundColor Green
} else {
  Write-Host "`n[1/4] Skipping frontend build" -ForegroundColor Gray
}

# ── Step 3: Build Backend ─────────────────────────────────────
if (-not $SkipBackend) {
  Write-Host "[2/4] Building backend..." -ForegroundColor Yellow
  Push-Location (Join-Path $ROOT "backend")
  npm ci --prefer-offline 2>$null
  npm run build
  Pop-Location
  Write-Host "  ✓ Backend built" -ForegroundColor Green
} else {
  Write-Host "[2/4] Skipping backend build" -ForegroundColor Gray
}

# ── Step 4: Assemble deploy folder ────────────────────────────
Write-Host "[3/4] Assembling deploy folder..." -ForegroundColor Yellow

# Copy backend dist + package files
Copy-Item (Join-Path $ROOT "backend\dist") (Join-Path $DEPLOY "dist") -Recurse
Copy-Item (Join-Path $ROOT "backend\package.json") (Join-Path $DEPLOY "package.json")
Copy-Item (Join-Path $ROOT "backend\package-lock.json") (Join-Path $DEPLOY "package-lock.json") -ErrorAction SilentlyContinue

# Copy frontend build into backend/public (served by Express in production)
$frontendDist = Join-Path $ROOT "frontend\dist"
if (Test-Path $frontendDist) {
  Copy-Item $frontendDist (Join-Path $DEPLOY "public") -Recurse
  Write-Host "  ✓ Frontend assets copied to deploy/public/" -ForegroundColor Green
}

# Copy uploads folder structure (empty)
New-Item -ItemType Directory -Path (Join-Path $DEPLOY "uploads\resumes") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DEPLOY "uploads\logos") -Force | Out-Null

# Copy .env.production as .env template
$envProd = Join-Path $ROOT "backend\.env.production"
if (Test-Path $envProd) {
  Copy-Item $envProd (Join-Path $DEPLOY ".env")
  Write-Host "  ✓ .env.production copied as .env" -ForegroundColor Green
}

# Copy .htaccess for Hostinger
$htaccess = Join-Path $ROOT ".htaccess"
if (Test-Path $htaccess) {
  Copy-Item $htaccess (Join-Path $DEPLOY ".htaccess")
}

# ── Step 5: Create Hostinger startup file ─────────────────────
Write-Host "[4/4] Writing app.js entry point..." -ForegroundColor Yellow
@"
// Hostinger Node.js entry point
// This file should be set as "Application startup file" in Hostinger panel
require('./dist/server.js');
"@ | Set-Content (Join-Path $DEPLOY "app.js")

Write-Host "`n=== Deploy folder ready ===" -ForegroundColor Green
Write-Host "Location: $DEPLOY" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit deploy/.env with production values"
Write-Host "  2. Zip the deploy/ folder contents"
Write-Host "  3. Upload to Hostinger via File Manager or Git"
Write-Host "  4. Run 'npm ci --omit=dev' in Hostinger SSH terminal"
Write-Host "  5. Set startup file to 'app.js' in Hostinger Node.js panel"
Write-Host "  6. Restart the application"
Write-Host ""
