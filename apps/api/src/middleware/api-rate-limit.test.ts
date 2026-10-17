import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/jwt.js', () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (!token.startsWith('good-')) throw new Error('bad token');
    return { userId: token.slice(5), familyId: 'f' };
  }),
}));

import { ACCESS_COOKIE } from '../lib/cookies.js';
import { createApiRateLimit } from './api-rate-limit.js';

function appWith(options: { anonymousLimit: number; userLimit: number; refreshLimit?: number }) {
  const app = express();
  app.use(...createApiRateLimit(options));
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/api/auth/refresh', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

const as = (app: express.Express, token?: string) => {
  const req = request(app).get('/ping');
  return token ? req.set('Cookie', `${ACCESS_COOKIE}=${token}`) : req;
};

async function statuses(app: express.Express, count: number, token?: string) {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push((await as(app, token)).status);
  return out;
}

describe('api rate limit', () => {
  it('limits anonymous callers per IP', async () => {
    const app = appWith({ anonymousLimit: 2, userLimit: 10 });
    expect(await statuses(app, 3)).toEqual([200, 200, 429]);
    const blocked = await as(app);
    expect(blocked.body).toEqual({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    });
  });

  it('gives a signed-in user the higher limit', async () => {
    const app = appWith({ anonymousLimit: 2, userLimit: 5 });
    expect(await statuses(app, 6, 'good-u1')).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('counts each user separately, so one user cannot use up another’s allowance', async () => {
    const app = appWith({ anonymousLimit: 1, userLimit: 2 });
    await statuses(app, 3, 'good-u1');
    expect(await statuses(app, 2, 'good-u2')).toEqual([200, 200]);
  });

  it('does not let a user’s traffic count against the shared IP allowance', async () => {
    const app = appWith({ anonymousLimit: 1, userLimit: 5 });
    await statuses(app, 3, 'good-u1');
    expect(await statuses(app, 2)).toEqual([200, 429]);
  });

  it('gives session refreshes their own allowance, so they never use up the anonymous one', async () => {
    const app = appWith({ anonymousLimit: 2, userLimit: 50, refreshLimit: 4 });
    const refresh = async () => (await request(app).post('/api/auth/refresh')).status;
    expect([
      await refresh(),
      await refresh(),
      await refresh(),
      await refresh(),
      await refresh(),
    ]).toEqual([200, 200, 200, 200, 429]);
    expect(await statuses(app, 3)).toEqual([200, 200, 429]);
  });

  it('keeps the anonymous allowance for everything else, such as logins and probes', async () => {
    const app = appWith({ anonymousLimit: 2, userLimit: 50, refreshLimit: 1000 });
    await statuses(app, 3);
    expect((await request(app).post('/api/auth/refresh')).status).toBe(200);
  });

  it('treats a forged or expired token as anonymous', async () => {
    const app = appWith({ anonymousLimit: 2, userLimit: 50 });
    expect(await statuses(app, 3, 'forged')).toEqual([200, 200, 429]);
  });
});
