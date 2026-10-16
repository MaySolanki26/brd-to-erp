import { vi } from 'vitest';

export const TEST_ORIGIN = 'http://localhost:5173';

export const envModule = {
  env: {
    APP_ENV: 'development',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CORS_ORIGINS: [TEST_ORIGIN],
    LOG_LEVEL: 'error',
    JWT_ACCESS_SECRET: 'test-access-secret-min-16',
    JWT_ACCESS_EXPIRY_SECONDS: 900,
    JWT_REFRESH_EXPIRY_SECONDS: 604800,
  },
};

export const loggerModule = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'error',
    levels: { values: { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 } },
  },
};
