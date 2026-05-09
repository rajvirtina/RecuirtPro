# MongoDB Credentials & Setup Guide

## Current MongoDB Connection

### Local MongoDB (No Authentication - Default)
```
Host: localhost
Port: 27017
Database: recruitpro
URI: mongodb://localhost:27017/recruitpro
```

## Setting Up MongoDB with Authentication

### Option 1: Create Admin User (Recommended)

1. **Open MongoDB Shell:**
```powershell
mongo
# Or for newer versions:
mongosh
```

2. **Create Admin User:**
```javascript
use admin

db.createUser({
  user: "admin",
  pwd: "password123",  // Change this password!
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" }
  ]
})
```

3. **Create Application User:**
```javascript
use recruitpro

db.createUser({
  user: "recruitpro_user",
  pwd: "recruitpro_pass123",  // Change this password!
  roles: [
    { role: "readWrite", db: "recruitpro" },
    { role: "dbAdmin", db: "recruitpro" }
  ]
})
```

4. **Update .env file:**
```env
# Using admin user
MONGODB_URI=mongodb://admin:password123@localhost:27017/recruitpro?authSource=admin

# Or using application user
MONGODB_URI=mongodb://recruitpro_user:recruitpro_pass123@localhost:27017/recruitpro?authSource=recruitpro
```

### Option 2: MongoDB Atlas (Cloud - Free Tier Available)

1. **Sign up at**: https://www.mongodb.com/cloud/atlas
2. **Create a Free Cluster**
3. **Create Database User:**
   - Username: `recruitpro_admin`
   - Password: (auto-generate or create strong password)
4. **Whitelist IP Address**: Add `0.0.0.0/0` for development (allows all IPs)
5. **Get Connection String:**
```env
MONGODB_URI=mongodb+srv://recruitpro_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/recruitpro?retryWrites=true&w=majority
```

## Quick Start Credentials

### For Local Development (No Auth)
```env
MONGODB_URI=mongodb://localhost:27017/recruitpro
```
✅ **Already configured and working!**

### For Local Development (With Auth)
```env
MONGODB_URI=mongodb://admin:password123@localhost:27017/recruitpro?authSource=admin
```

### For Production/Cloud
```env
MONGODB_URI=mongodb+srv://username:password@your-cluster.mongodb.net/recruitpro?retryWrites=true&w=majority
```

## Test MongoDB Connection

Run this script to test:
```powershell
cd backend
node -e "const mongoose = require('mongoose'); require('dotenv').config(); mongoose.connect(process.env.MONGODB_URI).then(() => { console.log('✅ MongoDB Connected!'); process.exit(0); }).catch((err) => { console.error('❌ Connection Failed:', err.message); process.exit(1); });"
```

## Enable MongoDB Authentication (Windows)

1. **Stop MongoDB Service:**
```powershell
net stop MongoDB
```

2. **Edit MongoDB Config** (`C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg`):
```yaml
security:
  authorization: enabled
```

3. **Start MongoDB Service:**
```powershell
net start MongoDB
```

4. **Test Connection:**
```powershell
mongosh "mongodb://admin:password123@localhost:27017/admin"
```

## Common MongoDB Commands

### Check Connection
```javascript
// In mongo shell
db.runCommand({ connectionStatus: 1 })
```

### List Databases
```javascript
show dbs
```

### Switch Database
```javascript
use recruitpro
```

### Show Collections
```javascript
show collections
```

### List Users
```javascript
use admin
db.system.users.find().pretty()
```

## Connection String Format

### Standard Format
```
mongodb://[username:password@]host[:port][/database][?options]
```

### With Authentication
```
mongodb://username:password@host:port/database?authSource=admin
```

### Multiple Hosts (Replica Set)
```
mongodb://user:pass@host1:27017,host2:27017,host3:27017/database?replicaSet=myReplicaSet
```

### MongoDB Atlas (Cloud)
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

## Troubleshooting

### Error: Authentication failed
- Check username and password
- Verify `authSource` parameter
- Ensure user has correct roles

### Error: Connection refused
- Check if MongoDB is running: `Get-Service MongoDB`
- Verify port 27017 is open
- Check firewall settings

### Error: Database not found
- Database will be created automatically on first write
- No need to create database manually

## Security Best Practices

1. **Use Strong Passwords:**
   - Minimum 12 characters
   - Mix of letters, numbers, symbols

2. **Create Application-Specific Users:**
   - Don't use admin user for applications
   - Grant minimum required permissions

3. **Use Environment Variables:**
   - Never commit credentials to Git
   - Use `.env` files (already in `.gitignore`)

4. **Enable TLS/SSL in Production:**
```env
MONGODB_URI=mongodb://user:pass@host:27017/db?tls=true
```

5. **IP Whitelisting:**
   - Only allow connections from known IPs
   - Use VPN for remote access

## Current Setup Status

✅ **MongoDB Connection**: Working (localhost, no auth)
✅ **Database Name**: recruitpro
✅ **Environment File**: Configured
✅ **Migration Script**: Tested successfully

### To Start Using Authentication:

1. Create MongoDB users (see above)
2. Update `MONGODB_URI` in `.env`
3. Restart backend server
4. Test connection

---

**Note**: For local development, no authentication is fine. For production, always use authentication and TLS/SSL.
