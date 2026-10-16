import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: vi.fn(), $disconnect: vi.fn() },
  disconnectPrisma: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  env: {
    APP_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CORS_ORIGINS: [],
    LOG_LEVEL: 'error',
  },
}));

vi.mock('../lib/logger.js', () => ({
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
}));

vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('Not found handler', () => {
  it('returns 404 JSON for an unknown route', async () => {
    const app = createApp();
    const res = await request(app).get('/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('/this-route-does-not-exist');
  });
});
