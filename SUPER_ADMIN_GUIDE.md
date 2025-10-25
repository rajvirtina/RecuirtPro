# Super Admin Account Setup Guide

This guide explains how to create and login to a Super Admin account in RecuirtPro.

## Quick Start

### Option 1: Create New Super Admin (Recommended)

```bash
# Navigate to backend directory
cd backend

# Create super admin account
node scripts/createSuperAdmin.js <email> <password> [firstName] [lastName]
```

**Example:**
```bash
node scripts/createSuperAdmin.js superadmin@recruitpro.com Admin@123 Super Admin
```

### Option 2: Convert Existing User to Admin

```bash
# Navigate to backend directory
cd backend

# Make existing user an admin
node scripts/makeAdmin.js <email>
```

**Example:**
```bash
node scripts/makeAdmin.js john@example.com
```

---

## Detailed Instructions

### Method 1: Using the createSuperAdmin Script

#### Step 1: Navigate to Backend Directory
```bash
cd E:\RecuirtPro\backend
```

#### Step 2: Run the Script
```bash
node scripts/createSuperAdmin.js <email> <password> [firstName] [lastName]
```

**Parameters:**
- `<email>` - Super admin email (required)
- `<password>` - Password (required, min 6 characters)
- `[firstName]` - First name (optional, default: "Super")
- `[lastName]` - Last name (optional, default: "Admin")

#### Example Output:
```
✅ Connected to MongoDB

✅ Successfully created Super Admin account!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Super Admin Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:     superadmin@recruitpro.com
Name:      Super Admin
Role:      ADMIN
Status:    ACTIVE
Verified:  Yes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 You can now login with these credentials:
   Email:    superadmin@recruitpro.com
   Password: Admin@123

💡 Login URL: http://localhost:5173/login
```

### Method 2: Convert Existing User to Admin

If you already have a user account created, you can convert it to admin:

```bash
node scripts/makeAdmin.js your-email@example.com
```

This will:
- Change the user's role to 'admin'
- Keep their existing password
- Display the updated user details

---

## Login Process

### Step 1: Start the Application

**Terminal 1 - Backend:**
```bash
cd E:\RecuirtPro\backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd E:\RecuirtPro\frontend
npm run dev
```

### Step 2: Access Login Page
Open your browser and navigate to:
```
http://localhost:5173/login
```

### Step 3: Login with Super Admin Credentials
- **Email:** The email you used when creating the super admin
- **Password:** The password you set

### Step 4: Access Super Admin Panel
After successful login, navigate to:
```
http://localhost:5173/superadmin
```

Or click on **"Super Admin Panel"** from the navigation menu.

---

## Super Admin Capabilities

Once logged in as Super Admin, you can:

### 1. Manage Customer Companies
- ✅ View all customer companies
- ✅ Create new companies
- ✅ Delete companies
- ✅ View company details (name, email, phone, website)

### 2. Manage Company Admins
- ✅ Create admin accounts for each company
- ✅ Create HR manager accounts for each company
- ✅ View all company admins and HR managers
- ✅ Delete admin/HR accounts
- ✅ Assign admins to specific companies

### 3. Access All Features
As an admin, you have access to:
- All job postings across companies
- All applications
- All interviews
- All candidates
- System statistics and analytics

---

## Troubleshooting

### Issue: "User already exists with this email"

**Solution 1:** Use the existing user and convert to admin
```bash
node scripts/makeAdmin.js existing-email@example.com
```

**Solution 2:** Force update the existing user
```bash
node scripts/createSuperAdmin.js existing@email.com NewPassword123 First Last yes
```

### Issue: "Cannot connect to MongoDB"

**Check if MongoDB is running:**
```bash
# Windows - Check if MongoDB service is running
Get-Service -Name MongoDB

# If not running, start it
net start MongoDB
```

**Verify MongoDB connection string:**
- Default: `mongodb://localhost:27017/recruitpro`
- Check `backend/src/config/index.ts` for your MongoDB URI

### Issue: "Login fails after creating account"

**Verify account status:**
```bash
node scripts/checkUser.js superadmin@recruitpro.com
```

**Ensure:**
- `status` is `active`
- `emailVerified` is `true`
- `role` is `admin`

**Activate if needed:**
```bash
node scripts/activateUser.js superadmin@recruitpro.com
```

### Issue: "Cannot access Super Admin Panel"

**Verify role-based routing:**
1. Check that you're logged in as `admin` role
2. Navigate directly to: `http://localhost:5173/superadmin`
3. Check browser console for errors (F12)

**Verify authentication:**
- Open browser DevTools (F12)
- Go to Application → Local Storage
- Check for `auth-storage` with user data
- Verify `role: "admin"`

---

## Default Super Admin Credentials (For Development)

If you want a quick setup for development:

```bash
# Create with default credentials
node scripts/createSuperAdmin.js admin@recruitpro.com Admin@123 System Admin
```

**Login with:**
- Email: `admin@recruitpro.com`
- Password: `Admin@123`

⚠️ **IMPORTANT:** Change these credentials in production!

---

## Security Best Practices

### 1. Strong Passwords
- Use passwords with at least 8 characters
- Include uppercase, lowercase, numbers, and symbols
- Example: `SuperAdmin@2025!`

### 2. Unique Email
- Use a dedicated email for super admin
- Don't use personal email addresses
- Example: `superadmin@yourcompany.com`

### 3. Secure Storage
- Never commit passwords to version control
- Store credentials securely (password manager)
- Rotate passwords regularly

### 4. Production Setup
```bash
# Use environment variables
node scripts/createSuperAdmin.js $SUPER_ADMIN_EMAIL $SUPER_ADMIN_PASSWORD
```

---

## Quick Reference Commands

```bash
# Create new super admin
node scripts/createSuperAdmin.js email@example.com Password123 First Last

# Convert existing user to admin
node scripts/makeAdmin.js email@example.com

# Check user details
node scripts/checkUser.js email@example.com

# Activate user account
node scripts/activateUser.js email@example.com

# Update password
node scripts/updatePassword.js email@example.com NewPassword123
```

---

## Next Steps After Login

1. **Create Your First Company**
   - Go to Super Admin Panel → Companies Tab
   - Click "Create New Company"
   - Fill in company details

2. **Create Company Admin**
   - Go to Company Admins Tab
   - Click "Create Company Admin"
   - Select the company
   - Choose role (Admin or HR Manager)
   - Fill in user details

3. **Company Admin Can:**
   - Post jobs for their company
   - Manage applications
   - Schedule interviews
   - Invite more HR managers

---

## Support

If you encounter issues:

1. Check MongoDB is running
2. Check backend server is running on port 3000
3. Check frontend server is running on port 5173
4. Review browser console for errors (F12)
5. Review backend logs in terminal

For additional help, check:
- `README.md` - General project documentation
- `ARCHITECTURE.md` - System architecture
- `USER_DOCUMENTATION.md` - Feature documentation
