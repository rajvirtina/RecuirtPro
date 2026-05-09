# Production Deployment Preparation Script (Windows PowerShell)
# This script removes unnecessary files and prepares the codebase for production

Write-Host "🚀 Preparing for Production Deployment..." -ForegroundColor Green
Write-Host ""

# Remove test files
Write-Host "📝 Removing test files..." -ForegroundColor Yellow
Remove-Item -Path "test-*.js" -ErrorAction SilentlyContinue
Get-ChildItem -Path "backend\src" -Recurse -Filter "*.test.ts" | Remove-Item -ErrorAction SilentlyContinue
Get-ChildItem -Path "frontend\src" -Recurse -Filter "*.test.tsx" | Remove-Item -ErrorAction SilentlyContinue

# Remove documentation files (optional - comment out if you want to keep them)
Write-Host "📚 Removing documentation files..." -ForegroundColor Yellow
$docsToRemove = @(
    "ARCHITECTURE.md",
    "END_TO_END_TEST_PLAN.md",
    "FEATURES_IMPLEMENTATION.md",
    "QUICK_FIX.md",
    "SUPER_ADMIN_GUIDE.md",
    "USER_DOCUMENTATION.md",
    "BUGFIX_TECHNICAL_DOCUMENTATION.md",
    "QUICK_SETUP_GUIDE.md",
    "COMPANY_SLUG_GUIDE.md"
)
foreach ($doc in $docsToRemove) {
    Remove-Item -Path $doc -ErrorAction SilentlyContinue
}

# Remove dev environment files
Write-Host "🔐 Removing environment files..." -ForegroundColor Yellow
Remove-Item -Path ".env*" -ErrorAction SilentlyContinue
Remove-Item -Path "backend\.env*" -ErrorAction SilentlyContinue
Remove-Item -Path "frontend\.env*" -ErrorAction SilentlyContinue

# Remove node_modules (will be reinstalled on server)
Write-Host "📦 Removing node_modules..." -ForegroundColor Yellow
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "desktop-app\node_modules" -Recurse -Force -ErrorAction SilentlyContinue

# Remove build artifacts (will be regenerated)
Write-Host "🔨 Removing build artifacts..." -ForegroundColor Yellow
Remove-Item -Path "backend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "frontend\build" -Recurse -Force -ErrorAction SilentlyContinue

# Remove logs
Write-Host "📋 Removing log files..." -ForegroundColor Yellow
Get-ChildItem -Path "backend\logs" -Filter "*.log" -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
Remove-Item -Path "backend\*.log" -ErrorAction SilentlyContinue

# Remove uploaded test files (keep directory structure)
Write-Host "📁 Cleaning uploads directory..." -ForegroundColor Yellow
Get-ChildItem -Path "backend\uploads\resumes" -Include "*.pdf","*.doc","*.docx" -Recurse -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue

# Remove IDE files
Write-Host "💻 Removing IDE files..." -ForegroundColor Yellow
Remove-Item -Path ".vscode" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".idea" -Recurse -Force -ErrorAction SilentlyContinue

# Remove Git directory (optional - only if deploying without git)
# Write-Host "🗑️  Removing .git directory..." -ForegroundColor Yellow
# Remove-Item -Path ".git" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Production preparation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Review the changes"
Write-Host "2. Configure production environment variables on server"
Write-Host "3. Build the application:"
Write-Host "   - Backend: cd backend && npm install && npm run build"
Write-Host "   - Frontend: cd frontend && npm install && npm run build"
Write-Host "4. Deploy to production server"
Write-Host ""
Write-Host "⚠️  Remember to:" -ForegroundColor Yellow
Write-Host "   - Set production MongoDB URI"
Write-Host "   - Set JWT_SECRET"
Write-Host "   - Configure CORS_ORIGIN"
Write-Host "   - Set NODE_ENV=production"
Write-Host ""
