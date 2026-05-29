module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Inject env vars before any module is loaded (before ts-jest transforms config/index.ts)
  setupFiles: ['<rootDir>/src/__tests__/helpers/env.ts'],
  testTimeout: 30000, // mongodb-memory-server startup
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines:     20, // baseline; ratchet up each sprint
      functions: 20,
    },
  },
};
