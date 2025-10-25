# Deployment Guide - RecuirtPro

## Prerequisites
- Node.js 18+ installed
- MongoDB 6.0+ (or MongoDB Atlas account)
- Redis (optional but recommended)
- AWS Account (for S3 file storage)
- Domain name and SSL certificate
- SMTP server or SendGrid account

## Production Environment Setup

### 1. Server Preparation

#### Option A: AWS EC2
```bash
# Launch Ubuntu 22.04 LTS instance
# Configure security groups:
# - Port 22 (SSH)
# - Port 80 (HTTP)
# - Port 443 (HTTPS)
# - Port 27017 (MongoDB - if self-hosted, restrict to VPC)

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
```

#### Option B: Azure App Service
```bash
# Create App Service
az webapp create --resource-group myResourceGroup \
  --plan myAppServicePlan --name recruitpro-api \
  --runtime "NODE|18-lts"

# Configure environment variables
az webapp config appsettings set --resource-group myResourceGroup \
  --name recruitpro-api --settings @appsettings.json
```

### 2. Database Setup

#### MongoDB Atlas (Recommended)
1. Create cluster at mongodb.com/atlas
2. Configure IP whitelist
3. Create database user
4. Get connection string
5. Update `MONGODB_URI` in production `.env`

#### Self-Hosted MongoDB
```bash
# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Secure MongoDB
mongo admin --eval "db.createUser({user: 'admin', pwd: 'securepassword', roles: ['root']})"
```

### 3. Redis Setup (Optional)

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: requirepass your_redis_password

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### 4. Application Deployment

```bash
# Clone repository
git clone https://github.com/your-org/RecuirtPro.git
cd RecuirtPro

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Build applications
npm run build

# Setup environment variables
cd backend
cp .env.example .env
nano .env
# Update all production values

cd ../frontend
cp .env.example .env
nano .env
# Update API URL to production domain
```

### 5. Environment Variables (Production)

#### Backend `.env`
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/recruitpro
JWT_SECRET=<64-character-random-string>
JWT_REFRESH_SECRET=<64-character-random-string>
CORS_ORIGIN=https://recruitpro.com
FRONTEND_URL=https://recruitpro.com

# AWS S3
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
AWS_S3_BUCKET=recruitpro-prod

# Email (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>

# Integrations
MS_CLIENT_ID=<microsoft-app-id>
MS_CLIENT_SECRET=<microsoft-secret>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-secret>
NAUKRI_API_KEY=<naukri-key>
```

### 6. PM2 Process Management

```bash
# Start backend with PM2
cd backend
pm2 start dist/server.js --name recruitpro-api

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the command it provides

# Monitor processes
pm2 monit

# View logs
pm2 logs recruitpro-api
```

### 7. Nginx Configuration

```nginx
# /etc/nginx/sites-available/recruitpro
server {
    listen 80;
    server_name api.recruitpro.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.recruitpro.com;

    ssl_certificate /etc/letsencrypt/live/api.recruitpro.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.recruitpro.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name recruitpro.com www.recruitpro.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name recruitpro.com www.recruitpro.com;

    ssl_certificate /etc/letsencrypt/live/recruitpro.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recruitpro.com/privkey.pem;

    root /var/www/recruitpro/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/recruitpro /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d api.recruitpro.com -d recruitpro.com -d www.recruitpro.com
```

### 8. Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy to web server
sudo mkdir -p /var/www/recruitpro
sudo cp -r dist/* /var/www/recruitpro/frontend/
sudo chown -R www-data:www-data /var/www/recruitpro
```

### 9. Monitoring & Logging

```bash
# Setup log rotation for PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 10

# Monitor server resources
sudo apt install -y htop iotop
```

### 10. Security Hardening

```bash
# Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# Auto security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 11. Backup Strategy

```bash
# MongoDB backup script
cat > /home/ubuntu/backup-mongo.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/backup_$TIMESTAMP"
# Upload to S3
aws s3 sync $BACKUP_DIR s3://recruitpro-backups/mongodb/
# Delete local backups older than 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
EOF

chmod +x /home/ubuntu/backup-mongo.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-mongo.sh
```

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install
        cd backend && npm install
        cd ../frontend && npm install
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/recruitpro
          git pull origin main
          npm install
          npm run build
          pm2 restart recruitpro-api
```

## Health Checks

Add to `backend/src/app.ts`:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env
  });
});
```

## Monitoring Tools

- **Application**: PM2, New Relic, Datadog
- **Logs**: Winston + CloudWatch/ELK Stack
- **Uptime**: UptimeRobot, Pingdom
- **Errors**: Sentry
- **Analytics**: Google Analytics, Mixpanel

## Rollback Procedure

```bash
# View PM2 app list
pm2 list

# Stop application
pm2 stop recruitpro-api

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild
npm run build:backend

# Restart
pm2 restart recruitpro-api
```

## Performance Optimization

1. Enable gzip compression in Nginx
2. Use CDN for static assets
3. Implement database indexing
4. Enable Redis caching
5. Optimize images
6. Use connection pooling
7. Implement rate limiting

---

**Production Checklist**
- [ ] All environment variables set
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] MongoDB secured with authentication
- [ ] Backups automated
- [ ] Monitoring tools configured
- [ ] Health checks working
- [ ] CI/CD pipeline setup
- [ ] Documentation updated
- [ ] Security audit completed
