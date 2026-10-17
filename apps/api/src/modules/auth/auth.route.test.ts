import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../../config/env.js', async () => (await import('../../test/test-env.js')).envModule);
vi.mock('../../lib/logger.js', async () => (await import('../../test/test-env.js')).loggerModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);
vi.mock(
  './auth.repository.js',
  async () => (await import('../../test/fake-db.js')).authRepositoryModule,
);
vi.mock(
  '../access/access.repository.js',
  async () => (await import('../../test/fake-db.js')).accessRepositoryModule,
);
vi.mock(
  '../projects/projects.repository.js',
  async () => (await import('../../test/fake-db.js')).projectsRepositoryModule,
);
vi.mock(
  '../members/members.repository.js',
  async () => (await import('../../test/fake-db.js')).membersRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { createApp } from '../../app.js';
import { REFRESH_REUSE_GRACE_MS } from './auth.service.js';
import { db } from '../../test/fake-db.js';
import { TEST_ORIGIN } from '../../test/test-env.js';
import { as, cookieHeader, login, parseSetCookies } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

describe('auth routes', () => {
  let world: World;

  beforeEach(async () => {
    world = await buildWorld();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('POST /api/auth/login', () => {
    it('sets httpOnly access and refresh cookies, a readable csrf cookie, and audits success', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: world.ownerA.email, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: world.ownerA.id, orgRole: 'MEMBER' });
      expect(res.body.user.passwordHash).toBeUndefined();

      const lines = res.headers['set-cookie'] as unknown as string[];
      const access = lines.find((l) => l.startsWith('access_token='));
      const refresh = lines.find((l) => l.startsWith('refresh_token='));
      const csrf = lines.find((l) => l.startsWith('csrf_token='));
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/SameSite=Lax/);
      expect(refresh).toMatch(/HttpOnly/);
      expect(refresh).toMatch(/Path=\/api\/auth/);
      expect(csrf).not.toMatch(/HttpOnly/);
      expect(db.audit.map((a) => a.action)).toContain('LOGIN_SUCCESS');
    });

    it('returns the identical error for an unknown email and a wrong password', async () => {
      const unknown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.dev', password: PASSWORD });
      const wrong = await request(app)
        .post('/api/auth/login')
        .send({ email: world.ownerA.email, password: 'wrong-password' });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.body.error.code).toBe(wrong.body.error.code);
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
      expect(db.audit.filter((a) => a.action === 'LOGIN_FAILURE')).toHaveLength(2);
    });

    it('does not store the raw email or password in the audit log', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.dev', password: 'secret-pw' });
      const serialised = JSON.stringify(db.audit);
      expect(serialised).not.toContain('nobody@test.dev');
      expect(serialised).not.toContain('secret-pw');
    });

    it('rejects an invalid body with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' });
      expect(res.status).toBe(400);
    });

    it('locks the account after 5 failures for 15 minutes, with the same error', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      for (let i = 0; i < 5; i += 1) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: world.ownerA.email, password: 'wrong' });
        expect(res.status).toBe(401);
      }
      expect(world.ownerA.lockedUntil).not.toBeNull();

      const locked = await request(app)
        .post('/api/auth/login')
        .send({ email: world.ownerA.email, password: PASSWORD });
      expect(locked.status).toBe(401);
      expect(locked.body.error.message).toBe('Invalid email or password');

      vi.setSystemTime(new Date('2026-01-01T00:14:59Z'));
      const stillLocked = await request(app)
        .post('/api/auth/login')
        .send({ email: world.ownerA.email, password: PASSWORD });
      expect(stillLocked.status).toBe(401);

      vi.setSystemTime(new Date('2026-01-01T00:15:01Z'));
      const unlocked = await request(app)
        .post('/api/auth/login')
        .send({ email: world.ownerA.email, password: PASSWORD });
      expect(unlocked.status).toBe(200);
      expect(world.ownerA.failedLoginCount).toBe(0);
    });

    it('resets the failure counter after a successful login', async () => {
      for (let i = 0; i < 4; i += 1) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: world.ownerA.email, password: 'wrong' });
      }
      await login(app, world.ownerA.email, PASSWORD);
      expect(world.ownerA.failedLoginCount).toBe(0);
    });
  });

  describe('login rate limit', () => {
    it('returns 429 after 10 attempts for the same ip and email', async () => {
      const limited = createApp({ rateLimit: true });
      let last = 0;
      for (let i = 0; i < 11; i += 1) {
        const res = await request(limited)
          .post('/api/auth/login')
          .send({ email: 'nobody@test.dev', password: 'x' });
        last = res.status;
      }
      expect(last).toBe(429);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without a cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for a tampered access token', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', 'access_token=not.a.jwt');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid session', async () => {
      const session = await login(app, world.adminA.email, PASSWORD);
      const res = await as(app, session, 'get', '/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: world.adminA.id, orgRole: 'ORG_ADMIN' });
    });

    it('rejects a deleted user immediately even with an unexpired token', async () => {
      const session = await login(app, world.viewerA.email, PASSWORD);
      world.viewerA.deletedAt = new Date();
      const res = await as(app, session, 'get', '/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 401 without a refresh cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('rotates the refresh token and issues new cookies', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session))
        .set('Origin', TEST_ORIGIN);

      expect(res.status).toBe(200);
      const rotated = parseSetCookies(res);
      expect(rotated['refresh_token']).toBeTruthy();
      expect(rotated['refresh_token']).not.toBe(session.cookies['refresh_token']);
      expect(rotated['access_token']).toBeTruthy();
      expect(rotated['csrf_token']).not.toBe(session.cookies['csrf_token']);
    });

    it('treats an immediate second use of a rotated token as a concurrent refresh, not theft', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      const first = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session));
      const rotated = parseSetCookies(first);

      const concurrent = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session));
      expect(concurrent.status).toBe(401);
      expect(db.audit.map((a) => a.action)).not.toContain('TOKEN_REUSE_DETECTED');

      const stillValid = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${rotated['refresh_token']}`);
      expect(stillValid.status).toBe(200);
    });

    it('rejects a replayed token and revokes the whole family', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const session = await login(app, world.ownerA.email, PASSWORD);
      const first = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session));
      const rotated = parseSetCookies(first);
      vi.setSystemTime(Date.now() + REFRESH_REUSE_GRACE_MS + 1000);

      const replay = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session));
      expect(replay.status).toBe(401);
      expect(db.audit.map((a) => a.action)).toContain('TOKEN_REUSE_DETECTED');

      // The legitimately rotated token belongs to the same family, so it is dead too.
      const afterReuse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${rotated['refresh_token']}`);
      expect(afterReuse.status).toBe(401);
    });

    it('rejects an unknown refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=forged');
      expect(res.status).toBe(401);
    });

    it('rejects an expired refresh token', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      for (const s of db.sessions.values()) s.expiresAt = new Date(Date.now() - 1000);
      const res = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader(session));
      expect(res.status).toBe(401);
    });

    it('rejects a cross-site origin', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session))
        .set('Origin', 'https://evil.example');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the session so the refresh token stops working', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      const out = await as(app, session, 'post', '/api/auth/logout');
      expect(out.status).toBe(200);
      expect(db.audit.map((a) => a.action)).toContain('LOGOUT');

      const refresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(session));
      expect(refresh.status).toBe(401);
    });

    it('also ends the access token, not only the refresh token', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      expect((await as(app, session, 'get', '/api/auth/me')).status).toBe(200);

      await as(app, session, 'post', '/api/auth/logout');

      expect((await as(app, session, 'get', '/api/auth/me')).status).toBe(401);
    });

    it('requires the csrf header when cookies are present', async () => {
      const session = await login(app, world.ownerA.email, PASSWORD);
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookieHeader(session))
        .set('Origin', TEST_ORIGIN);
      expect(res.status).toBe(403);
    });
  });
});
