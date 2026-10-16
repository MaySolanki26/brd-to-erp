import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  },
  disconnectPrisma: vi.fn(),
}));

vi.mock('../../config/env.js', () => ({
  env: {
    APP_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CORS_ORIGINS: [],
    LOG_LEVEL: 'error',
  },
}));

vi.mock('../../lib/logger.js', () => ({
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

import { prisma } from '../../lib/prisma.js';

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with status ok when database is up', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ '?column?': 1 }]);

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns 503 with status degraded when database is down', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error('Connection refused'));

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });
});
