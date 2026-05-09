# Quick Start Script for RecuirtPro (PowerShell)
# This script starts both backend and frontend servers

Write-Host "🚀 Starting RecuirtPro Application..." -ForegroundColor Green
Write-Host ""

# Check if MongoDB is running
$mongoService = Get-Service | Where-Object {$_.Name -like "*mongo*"}
if ($mongoService -and $mongoService.Status -eq "Running") {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  MongoDB service not found or not running" -ForegroundColor Yellow
    Write-Host "   Please start MongoDB manually or run: net start MongoDB" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Application URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend API: http://localhost:5001/api/v1" -ForegroundColor White
Write-Host "   MongoDB: mongodb://localhost:27017/recruitpro" -ForegroundColor White
Write-Host ""

# Start Backend in background
Write-Host "🔧 Starting Backend Server..." -ForegroundColor Yellow
$backendPath = "c:\Users\HP\Downloads\RecuirtPro-main\RecuirtPro-main\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend Server Starting...' -ForegroundColor Green; npm run dev"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend in background
Write-Host "🎨 Starting Frontend Server..." -ForegroundColor Yellow
$frontendPath = "c:\Users\HP\Downloads\RecuirtPro-main\RecuirtPro-main\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend Server Starting...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "✅ Both servers are starting..." -ForegroundColor Green
Write-Host ""
Write-Host "📝 To stop servers:" -ForegroundColor Cyan
Write-Host "   Close the PowerShell windows or press Ctrl+C in each" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Check the separate PowerShell windows for server logs" -ForegroundColor Cyan
Write-Host ""
