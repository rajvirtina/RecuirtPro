# LLM Service Setup Verification Script (Windows)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "RecruitPro LLM Service Setup Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Python
Write-Host "Checking Python..." -NoNewline
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3") {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "  $pythonVersion" -ForegroundColor Gray
    } else {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "  Python 3.10+ required. Found: $pythonVersion" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "  Python not found. Please install Python 3.10+" -ForegroundColor Yellow
    $allGood = $false
}

# Check .env file
Write-Host "Checking .env file..." -NoNewline
if (Test-Path .env) {
    Write-Host " OK" -ForegroundColor Green
    
    # Check OPENAI_API_KEY
    $envContent = Get-Content .env -Raw
    if ($envContent -match "OPENAI_API_KEY=sk-") {
        Write-Host "  OPENAI_API_KEY configured" -ForegroundColor Gray
    } else {
        Write-Host "  Warning: OPENAI_API_KEY not set" -ForegroundColor Yellow
        $allGood = $false
    }
} else {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "  .env file not found. Copy .env.example to .env" -ForegroundColor Yellow
    $allGood = $false
}

# Check requirements.txt
Write-Host "Checking requirements.txt..." -NoNewline
if (Test-Path requirements.txt) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $allGood = $false
}

# Check if virtual environment exists
Write-Host "Checking virtual environment..." -NoNewline
if (Test-Path venv) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " NOT FOUND" -ForegroundColor Yellow
    Write-Host "  Run: python -m venv venv" -ForegroundColor Gray
}

# Check app.py
Write-Host "Checking app.py..." -NoNewline
if (Test-Path app.py) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAIL" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Activate virtual environment:" -ForegroundColor White
    Write-Host "     .\venv\Scripts\activate" -ForegroundColor Gray
    Write-Host "  2. Install dependencies:" -ForegroundColor White
    Write-Host "     pip install -r requirements.txt" -ForegroundColor Gray
    Write-Host "  3. Start service:" -ForegroundColor White
    Write-Host "     .\start.ps1" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "Setup incomplete" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above." -ForegroundColor Yellow
    Write-Host "See QUICKSTART.md for detailed instructions." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - Quick Start: QUICKSTART.md" -ForegroundColor White
Write-Host "  - Integration: INTEGRATION.md" -ForegroundColor White
Write-Host "  - API Docs: http://localhost:8001/api/docs" -ForegroundColor White
Write-Host ""
