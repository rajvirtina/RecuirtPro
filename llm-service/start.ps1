# RecruitPro LLM Service Startup Script (Windows)

Write-Host "Starting RecruitPro LLM Service..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and configure your settings" -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$name" -Value $value
    }
}

# Check if OpenAI API key is set
if (-not $env:OPENAI_API_KEY) {
    Write-Host "Warning: OPENAI_API_KEY not set in .env" -ForegroundColor Yellow
    Write-Host "LLM service will not function without it" -ForegroundColor Yellow
}

# Get port from env or use default
$port = if ($env:SERVICE_PORT) { $env:SERVICE_PORT } else { "8001" }

# Start service
Write-Host "Starting service on port $port..." -ForegroundColor Cyan
uvicorn app:app --host 0.0.0.0 --port $port --reload
