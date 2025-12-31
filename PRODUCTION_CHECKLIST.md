# Production Deployment Checklist

## ✅ Files Cleaned (Completed)
- [x] node_modules removed (will reinstall on server)
- [x] Build artifacts removed (dist/, build/)
- [x] Log files removed
- [x] Environment files removed (.env*)
- [x] Test files removed
- [x] IDE files removed (.vscode, .idea)
- [x] Uploaded test resumes removed

## 📋 Pre-Deployment Tasks

### Backend Configuration
- [ ] Create production `.env` file on server with:
  ```env
  NODE_ENV=production
  PORT=5001
  MONGODB_URI=mongodb://your-production-db-url/recruitpro
  JWT_SECRET=your-secure-random-secret-key-here
  JWT_EXPIRE=7d
  CORS_ORIGIN=https://your-frontend-domain.com
  ```

### Frontend Configuration
- [ ] Create production `.env` file with:
  ```env
  VITE_API_URL=https://your-api-domain.com/api/v1
  ```

### Database
- [ ] MongoDB production instance ready
- [ ] Run company slug migration: `node scripts/addCompanySlugs.js`
- [ ] Database backup created
- [ ] Ensure indexes are created

### Security
- [ ] Strong JWT_SECRET set (32+ random characters)
- [ ] HTTPS/SSL configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Environment variables secured

## 🚀 Deployment Steps

### 1. Backend Deployment
```bash
cd backend
npm install --production
npm run build
node dist/server.js
# Or use PM2: pm2 start dist/server.js --name recruitpro-api
```

### 2. Frontend Deployment
```bash
cd frontend
npm install
npm run build
# Deploy 'dist' folder to your web server/CDN
```

### 3. Post-Deployment Verification
- [ ] API health check: `curl https://your-api/health`
- [ ] Frontend loads correctly
- [ ] Can create/view jobs
- [ ] Company-specific URLs work: `/company/{slug}/jobs`
- [ ] Interview video calls work
- [ ] Database connections stable
- [ ] Logs being written correctly

## 📦 Production Files Structure
```
production/
├── backend/
│   ├── dist/              (compiled JS)
│   ├── uploads/           (keep structure)
│   ├── package.json
│   ├── .env              (create on server)
│   └── scripts/          (keep for migrations)
├── frontend/
│   └── dist/             (static build)
├── README.md
├── DEPLOYMENT.md
└── PRIVACY_POLICY.md
```

## 🔧 Server Requirements
- Node.js 16+ or 18+
- MongoDB 4.4+
- 2GB+ RAM (recommended)
- HTTPS/SSL certificate
- Domain name configured

## ⚠️ Important Notes
1. **Never commit** production `.env` files to git
2. **Always backup** database before migrations
3. **Test** company slug migration in staging first
4. **Monitor** logs after deployment
5. **Set up** automatic backups for MongoDB
6. **Configure** PM2 or similar for process management

## 🆘 Rollback Plan
If deployment fails:
1. Keep previous deployment files
2. Restore MongoDB from backup
3. Point domain back to old deployment
4. Review logs for errors

## 📊 Monitoring
After deployment, monitor:
- [ ] API response times
- [ ] Error rates
- [ ] WebRTC connection success rate
- [ ] Database query performance
- [ ] Server CPU/Memory usage

---

**Production Ready Status**: Files cleaned and ready for deployment
**Next Action**: Configure environment variables on production server
