// Set minimal env vars before any module is imported.
// This file is referenced in jest.config.js setupFiles so it runs first.
process.env.NODE_ENV             = 'test';
process.env.JWT_SECRET           = 'test-jwt-secret-min-32-chars-long-enough';
process.env.JWT_REFRESH_SECRET   = 'test-refresh-secret-min-32-chars-long!!';
process.env.ENCRYPTION_KEY       = 'test-encryption-key-32-chars-long!!';
process.env.REDIS_HOST           = '';  // disables Bull queues in tests
process.env.ENABLE_EMAIL_VERIFICATION = 'false';
process.env.SKIP_EMAIL           = 'true';
// Prevent config/index.ts from attempting to load .env.production
process.env.MONGODB_URI          = 'mongodb://localhost/test-placeholder';
