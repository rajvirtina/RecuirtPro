#!/bin/bash

# Production Deployment Preparation Script
# This script removes unnecessary files and prepares the codebase for production

echo "🚀 Preparing for Production Deployment..."
echo ""

# Remove test files
echo "📝 Removing test files..."
rm -f test-*.js
rm -f backend/src/**/*.test.ts
rm -f frontend/src/**/*.test.tsx

# Remove documentation files (optional - comment out if you want to keep them)
echo "📚 Removing documentation files..."
rm -f ARCHITECTURE.md
rm -f END_TO_END_TEST_PLAN.md
rm -f FEATURES_IMPLEMENTATION.md
rm -f QUICK_FIX.md
rm -f SUPER_ADMIN_GUIDE.md
rm -f USER_DOCUMENTATION.md
rm -f BUGFIX_TECHNICAL_DOCUMENTATION.md
rm -f QUICK_SETUP_GUIDE.md
rm -f COMPANY_SLUG_GUIDE.md

# Remove dev environment files
echo "🔐 Removing environment files..."
rm -f .env
rm -f backend/.env
rm -f frontend/.env
rm -f .env.local
rm -f .env.development

# Remove node_modules (will be reinstalled on server)
echo "📦 Removing node_modules..."
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules
rm -rf desktop-app/node_modules

# Remove build artifacts (will be regenerated)
echo "🔨 Removing build artifacts..."
rm -rf backend/dist
rm -rf frontend/dist
rm -rf frontend/build

# Remove logs
echo "📋 Removing log files..."
rm -rf backend/logs/*.log
rm -f backend/*.log

# Remove uploaded test files (keep directory structure)
echo "📁 Cleaning uploads directory..."
find backend/uploads/resumes -type f -name "*.pdf" -delete 2>/dev/null || true
find backend/uploads/resumes -type f -name "*.doc*" -delete 2>/dev/null || true

# Remove Git directory (optional - only if deploying without git)
# echo "🗑️  Removing .git directory..."
# rm -rf .git

# Remove IDE files
echo "💻 Removing IDE files..."
rm -rf .vscode
rm -rf .idea

# Remove Docker dev files (keep production docker files)
# echo "🐳 Removing Docker dev files..."
# rm -f docker-compose.dev.yml

echo ""
echo "✅ Production preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the changes"
echo "2. Configure production environment variables on server"
echo "3. Build the application: npm run build"
echo "4. Deploy to production server"
echo ""
echo "⚠️  Remember to:"
echo "   - Set production MongoDB URI"
echo "   - Set JWT_SECRET"
echo "   - Configure CORS_ORIGIN"
echo "   - Set NODE_ENV=production"
echo ""
