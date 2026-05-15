import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root (works from both src/ and dist/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also try .env.production if NODE_ENV is production (override .env values except PORT)
if (process.env.NODE_ENV === 'production') {
  const hostPort = process.env.PORT; // preserve Hostinger-injected port
  dotenv.config({ path: path.resolve(__dirname, '../../.env.production'), override: true });
  if (hostPort) process.env.PORT = hostPort; // restore it if overwritten
}

// SEC-06: Reject default secrets in production
const DANGEROUS_DEFAULTS = [
  'default-secret-change-me',
  'refresh-secret-change-me',
  'default-encryption-key-change-me',
  'default-secret-key',        // BUG-003: LLM service default
];

if (process.env.NODE_ENV === 'production') {
  const jwtSecret     = process.env.JWT_SECRET || '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const encryptionKey = process.env.ENCRYPTION_KEY || '';
  const llmKey        = process.env.LLM_API_SECRET_KEY || '';

  if (!jwtSecret || DANGEROUS_DEFAULTS.includes(jwtSecret)) {
    throw new Error('FATAL: JWT_SECRET must be set to a secure value in production.');
  }
  if (!jwtRefreshSecret || DANGEROUS_DEFAULTS.includes(jwtRefreshSecret)) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be set to a secure value in production.');
  }
  if (!encryptionKey || DANGEROUS_DEFAULTS.includes(encryptionKey)) {
    throw new Error('FATAL: ENCRYPTION_KEY must be set to a secure value in production.');
  }
  // LLM service is optional — warn but don't crash if not configured
  if (!llmKey || DANGEROUS_DEFAULTS.includes(llmKey)) {
    console.warn('WARNING: LLM_API_SECRET_KEY not set — AI features will be disabled.');
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  
  // Server — B-11 fix: default to same port as the main PORT value
  server: {
    url: process.env.SERVER_URL || `http://localhost:${process.env.PORT || '5000'}`,
  },
  
  // Database
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro',
  
  // JWT — BUG-002: access token is short-lived (15m), refresh token stays long
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expire: process.env.JWT_EXPIRE || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  },
  
  // CORS — removed hardcoded internal IP (4.13)
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000', 
    'http://localhost:3001',
    'http://localhost:5173',
  ],
  
  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@recruitpro.com',
    fromName: process.env.EMAIL_FROM_NAME || 'RecuirtPro',
  },
  
  // SMS
  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'RECRUIT',
    provider: process.env.SMS_PROVIDER || 'twilio',
  },
  
  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'recruitpro-uploads',
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    tls: process.env.REDIS_TLS === 'true',
  },
  
  // Microsoft Graph
  microsoft: {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    tenantId: process.env.MS_TENANT_ID || 'common',
    redirectUri: process.env.MS_REDIRECT_URI || '',
  },
  
  // Google
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  
  // Zoho
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    redirectUri: process.env.ZOHO_REDIRECT_URI || '',
  },
  
  // Naukri
  naukri: {
    apiKey: process.env.NAUKRI_API_KEY || '',
    apiSecret: process.env.NAUKRI_API_SECRET || '',
    baseUrl: process.env.NAUKRI_BASE_URL || 'https://api.naukri.com',
  },
  
  // LinkedIn
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  },
  
  // Feature Flags
  features: {
    proctoring: process.env.ENABLE_PROCTORING === 'true',
    naukriIntegration: process.env.ENABLE_NAUKRI_INTEGRATION === 'true',
    linkedinIntegration: process.env.ENABLE_LINKEDIN_INTEGRATION === 'true',
    mfa: process.env.ENABLE_MFA === 'true',
    emailVerification: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '500' : '100'), 10),
  },
  
  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
  
  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Company
  companyName: process.env.COMPANY_NAME || 'RecuirtPro',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@recruitpro.com',
  
  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',
  
  // LLM Service
  llm: {
    serviceUrl: process.env.LLM_SERVICE_URL || 'http://localhost:8001',
    apiSecretKey: process.env.LLM_API_SECRET_KEY || 'default-secret-key',
  },

  // GitHub
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    token: process.env.GITHUB_TOKEN || '',
  },

  // Data Retention (in days)
  retention: {
    resumes: parseInt(process.env.RESUME_RETENTION_DAYS || '365', 10),
    auditLogs: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '730', 10),
    applications: parseInt(process.env.APPLICATION_RETENTION_DAYS || '180', 10),
  },
};

export default config;
