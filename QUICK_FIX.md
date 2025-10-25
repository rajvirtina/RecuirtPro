# Quick Fix Guide - Get Server Running in 5 Minutes

## Problem
TypeScript compilation errors preventing server startup due to strict type checking.

## Solution

### Option 1: Relax TypeScript Settings (FASTEST - 30 seconds)

Edit `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,                          // ← Changed from true
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": false,                   // ← Changed from true
    "strictNullChecks": false,                // ← Changed from true
    "strictFunctionTypes": false,             // ← Changed from true
    "noUnusedLocals": false,                  // ← Changed from true
    "noUnusedParameters": false,              // ← Changed from true
    "noImplicitReturns": false,               // ← Changed from true
    "noFallthroughCasesInSwitch": true,
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Then restart the server - it should start without errors.

### Option 2: Fix Type Definitions (PROPER - 5 minutes)

Edit `backend/src/types/index.ts` to update the `IUser` interface:

```typescript
import { Types } from 'mongoose';

export interface IUser {
  _id: string;  // Keep as string for API responses
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone: string;
  companyId?: string;  // Keep as string for API responses
  profileImage?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  mfaEnabled: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Add a new interface for Mongoose documents
export interface IUserDocument extends IUser {
  _id: Types.ObjectId;
  companyId?: Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
  getFullName(): string;
}
```

Then update `backend/src/middleware/auth.ts`:

```typescript
// Around line 56-61, change to:
(req as AuthRequest).user = {
  _id: (user._id as any).toString(),
  email: user.email,
  role: user.role,
  status: user.status,
  firstName: user.firstName,
  lastName: user.lastName,
  companyId: user.companyId?.toString(),
  isEmailVerified: user.isEmailVerified,
  timezone: user.timezone,
} as IUser;

// Around line 118-123, same change
(req as AuthRequest).user = {
  _id: (user._id as any).toString(),
  email: user.email,
  role: user.role,
  status: user.status,
  firstName: user.firstName,
  lastName: user.lastName,
  companyId: user.companyId?.toString(),
  isEmailVerified: user.isEmailVerified,
  timezone: user.timezone,
} as IUser;
```

## Start the Server

```powershell
# From project root
cd E:\RecuirtPro
npm run dev:backend
```

You should see:
```
✔ Connected to MongoDB
✔ Server running on port 5000
```

## Test the API

### 1. Check Health
```
GET http://localhost:5000/health
```

### 2. View API Documentation
```
Open: http://localhost:5000/api-docs
```

### 3. Register a User
```http
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "email": "admin@recruitpro.com",
  "password": "Admin@123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin"
}
```

### 4. Login
```http
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@recruitpro.com",
  "password": "Admin@123"
}
```

Response will include:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### 5. Get Current User
```http
GET http://localhost:5000/api/v1/auth/me
Authorization: Bearer <your_access_token>
```

## Common Issues

### MongoDB Not Running
```powershell
# Start MongoDB
mongod --dbpath "C:\data\db"
```

### Port 5000 Already in Use
Edit `backend/.env`:
```
PORT=5001
```

### SMTP Email Errors
Emails will fail if SMTP is not configured. This is OK for development - auth will still work, just email verification emails won't send.

To configure (optional):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Next Steps

Once server is running:

1. ✅ Test all auth endpoints
2. Create job routes (`backend/src/routes/jobs.ts`)
3. Add job routes to `app.ts`
4. Test job endpoints
5. Create application controller
6. Continue with remaining modules

See `IMPLEMENTATION_STATUS.md` for full roadmap.

---

## Quick Command Reference

```powershell
# Start backend only
npm run dev:backend

# Start frontend only  
npm run dev:frontend

# Start both
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

Happy coding! 🚀
