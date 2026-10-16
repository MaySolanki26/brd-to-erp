import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  '../auth/auth.repository.js',
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
import { db } from '../../test/fake-db.js';
import { TEST_ORIGIN } from '../../test/test-env.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

type Actor =
  'ownerA' | 'analystA' | 'approverA' | 'viewerA' | 'adminA' | 'outsiderA' | 'adminB' | 'userB';

const ACTORS: Actor[] = [
  'ownerA',
  'analystA',
  'approverA',
  'viewerA',
  'adminA',
  'outsiderA',
  'adminB',
  'userB',
];

interface Case {
  name: string;
  method: 'get' | 'post' | 'patch';
  path: (w: World) => string;
  body?: Record<string, unknown>;
  /** Expected status per actor against project p1. */
  expected: Record<Actor, number>;
}

const ALL_READ: Record<Actor, number> = {
  ownerA: 200,
  analystA: 200,
  approverA: 200,
  viewerA: 200,
  adminA: 200,
  outsiderA: 404,
  adminB: 404,
  userB: 404,
};

const OWNER_ONLY = (success: number): Record<Actor, number> => ({
  ownerA: success,
  analystA: 403,
  approverA: 403,
  viewerA: 403,
  adminA: success,
  outsiderA: 404,
  adminB: 404,
  userB: 404,
});

const CASES: Case[] = [
  {
    name: 'GET project',
    method: 'get',
    path: (w) => `/api/projects/${w.p1.id}`,
    expected: ALL_READ,
  },
  {
    name: 'PATCH project',
    method: 'patch',
    path: (w) => `/api/projects/${w.p1.id}`,
    body: { name: 'Renamed' },
    expected: OWNER_ONLY(200),
  },
  {
    name: 'archive project',
    method: 'post',
    path: (w) => `/api/projects/${w.p1.id}/archive`,
    expected: OWNER_ONLY(200),
  },
  {
    name: 'list members',
    method: 'get',
    path: (w) => `/api/projects/${w.p1.id}/members`,
    expected: OWNER_ONLY(200),
  },
  {
    name: 'add member',
    method: 'post',
    path: (w) => `/api/projects/${w.p1.id}/members`,
    body: { userId: '__outsider__', role: 'VIEWER' },
    expected: OWNER_ONLY(201),
  },
];

describe('projects API', () => {
  let world: World;
  const sessions = new Map<Actor, Session>();

  async function sessionFor(actor: Actor): Promise<Session> {
    const cached = sessions.get(actor);
    if (cached) return cached;
    const session = await login(app, world[actor].email, PASSWORD);
    sessions.set(actor, session);
    return session;
  }

  beforeEach(async () => {
    world = await buildWorld();
    sessions.clear();
  });

  describe('permission matrix', () => {
    for (const testCase of CASES) {
      describe(testCase.name, () => {
        for (const actor of ACTORS) {
          it(`${actor} -> ${testCase.expected[actor]}`, async () => {
            const body = testCase.body && {
              ...testCase.body,
              ...(testCase.body['userId'] === '__outsider__' ? { userId: world.outsiderA.id } : {}),
            };
            const session = await sessionFor(actor);
            const req = as(app, session, testCase.method, testCase.path(world));
            const res = await (body ? req.send(body) : req);
            expect(res.status).toBe(testCase.expected[actor]);
          });
        }
      });
    }

    it('returns 401 for every endpoint without a session', async () => {
      for (const testCase of CASES) {
        const res = await request(app)
          [testCase.method](testCase.path(world))
          .send(testCase.body ?? {});
        expect(res.status).toBe(401);
      }
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 for a project in another organization, even for its ORG_ADMIN', async () => {
      const session = await sessionFor('adminB');
      const res = await as(app, session, 'get', `/api/projects/${world.p1.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('gives the same 404 for a nonexistent id as for a forbidden project', async () => {
      const session = await sessionFor('outsiderA');
      const forbidden = await as(app, session, 'get', `/api/projects/${world.p1.id}`);
      const missing = await as(
        app,
        session,
        'get',
        '/api/projects/7f1b6a3e-5d4c-4b2a-9e8f-1a2b3c4d5e6f',
      );
      expect(missing.status).toBe(forbidden.status);
      expect(missing.body.error.message).toBe(forbidden.body.error.message);
    });

    it('returns 404 for a project the member does not belong to (cross-project)', async () => {
      const session = await sessionFor('analystA');
      const res = await as(app, session, 'get', `/api/projects/${world.p2.id}`);
      expect(res.status).toBe(404);
    });

    it('never lets a member of another org be added', async () => {
      const session = await sessionFor('ownerA');
      const res = await as(app, session, 'post', `/api/projects/${world.p1.id}/members`).send({
        userId: world.userB.id,
        role: 'VIEWER',
      });
      expect(res.status).toBe(404);
    });

    it('returns 404 on the very next request after a member is removed', async () => {
      const viewer = await sessionFor('viewerA');
      const owner = await sessionFor('ownerA');
      expect((await as(app, viewer, 'get', `/api/projects/${world.p1.id}`)).status).toBe(200);

      const removed = await as(
        app,
        owner,
        'delete',
        `/api/projects/${world.p1.id}/members/${world.viewerA.id}`,
      );
      expect(removed.status).toBe(204);

      expect((await as(app, viewer, 'get', `/api/projects/${world.p1.id}`)).status).toBe(404);
    });

    it('applies a demotion on the very next request', async () => {
      const analyst = await sessionFor('analystA');
      const owner = await sessionFor('ownerA');
      await as(
        app,
        owner,
        'patch',
        `/api/projects/${world.p1.id}/members/${world.analystA.id}`,
      ).send({
        role: 'VIEWER',
      });
      const res = await as(app, analyst, 'get', `/api/projects/${world.p1.id}`);
      expect(res.body.project.myRole).toBe('VIEWER');
    });
  });

  describe('GET /api/projects', () => {
    async function listIds(actor: Actor): Promise<string[]> {
      const res = await as(app, await sessionFor(actor), 'get', '/api/projects');
      expect(res.status).toBe(200);
      return (res.body.items as { id: string }[]).map((p) => p.id).sort();
    }

    it('lists only projects the member belongs to', async () => {
      expect(await listIds('analystA')).toEqual([world.p1.id]);
      expect(await listIds('ownerA')).toEqual([world.p1.id, world.p2.id].sort());
    });

    it('lists nothing for a user without memberships', async () => {
      expect(await listIds('outsiderA')).toEqual([]);
    });

    it('lists every project in the org for ORG_ADMIN and none from other orgs', async () => {
      expect(await listIds('adminA')).toEqual([world.p1.id, world.p2.id].sort());
      expect(await listIds('adminB')).toEqual([world.pB.id]);
    });

    it('reports myRole, null for a non-member ORG_ADMIN', async () => {
      const admin = await as(
        app,
        await sessionFor('adminA'),
        'get',
        `/api/projects/${world.p1.id}`,
      );
      expect(admin.body.project.myRole).toBeNull();
      const viewer = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        `/api/projects/${world.p1.id}`,
      );
      expect(viewer.body.project.myRole).toBe('VIEWER');
    });

    it('hides archived projects unless requested', async () => {
      const owner = await sessionFor('ownerA');
      await as(app, owner, 'post', `/api/projects/${world.p2.id}/archive`);
      const hidden = await as(app, owner, 'get', '/api/projects');
      expect((hidden.body.items as unknown[]).length).toBe(1);
      const shown = await as(app, owner, 'get', '/api/projects?includeArchived=true');
      expect((shown.body.items as unknown[]).length).toBe(2);
    });

    it('rejects an invalid page size', async () => {
      const res = await as(app, await sessionFor('ownerA'), 'get', '/api/projects?pageSize=1000');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/projects', () => {
    it('makes the creator OWNER and audits the creation', async () => {
      const session = await sessionFor('outsiderA');
      const res = await as(app, session, 'post', '/api/projects').send({ name: '  New  ' });
      expect(res.status).toBe(201);
      expect(res.body.project).toMatchObject({ name: 'New', myRole: 'OWNER', status: 'ACTIVE' });

      const get = await as(app, session, 'get', `/api/projects/${res.body.project.id as string}`);
      expect(get.status).toBe(200);
      expect(db.audit).toContainEqual(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Project',
          userId: world.outsiderA.id,
        }),
      );
    });

    it('creates the project inside the caller org only', async () => {
      const res = await as(app, await sessionFor('userB'), 'post', '/api/projects').send({
        name: 'B project',
      });
      expect(res.body.project.organizationId).toBe(world.orgB);
    });

    it('rejects an empty name', async () => {
      const res = await as(app, await sessionFor('ownerA'), 'post', '/api/projects').send({
        name: ' ',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('writes', () => {
    it('audits updates and archiving', async () => {
      const owner = await sessionFor('ownerA');
      await as(app, owner, 'patch', `/api/projects/${world.p1.id}`).send({ name: 'Renamed' });
      await as(app, owner, 'post', `/api/projects/${world.p1.id}/archive`);
      const actions = db.audit.filter((a) => a.entity === 'Project').map((a) => a.action);
      expect(actions).toEqual(['UPDATE', 'UPDATE']);
      expect(db.projects.get(world.p1.id)?.status).toBe('ARCHIVED');
    });

    it('treats archiving twice as a no-op', async () => {
      const owner = await sessionFor('ownerA');
      await as(app, owner, 'post', `/api/projects/${world.p1.id}/archive`);
      const again = await as(app, owner, 'post', `/api/projects/${world.p1.id}/archive`);
      expect(again.status).toBe(200);
      expect(db.audit.filter((a) => a.entity === 'Project')).toHaveLength(1);
    });

    it('refuses to modify an archived project with 409', async () => {
      const owner = await sessionFor('ownerA');
      await as(app, owner, 'post', `/api/projects/${world.p1.id}/archive`);
      const res = await as(app, owner, 'patch', `/api/projects/${world.p1.id}`).send({
        name: 'Nope',
      });
      expect(res.status).toBe(409);
    });

    it('rejects an empty patch and a non-uuid id with 400', async () => {
      const owner = await sessionFor('ownerA');
      expect((await as(app, owner, 'patch', `/api/projects/${world.p1.id}`).send({})).status).toBe(
        400,
      );
      expect((await as(app, owner, 'get', '/api/projects/not-a-uuid')).status).toBe(400);
    });

    it('does not allow setting ARCHIVED through PATCH', async () => {
      const owner = await sessionFor('ownerA');
      const res = await as(app, owner, 'patch', `/api/projects/${world.p1.id}`).send({
        status: 'ARCHIVED',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('csrf', () => {
    it('rejects a cookie-authenticated mutation without the csrf header', async () => {
      const session = await sessionFor('ownerA');
      const res = await request(app)
        .post('/api/projects')
        .set(
          'Cookie',
          Object.entries(session.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; '),
        )
        .set('Origin', TEST_ORIGIN)
        .send({ name: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('rejects a mismatching csrf token', async () => {
      const session = await sessionFor('ownerA');
      const res = await as(app, session, 'post', '/api/projects')
        .set('X-CSRF-Token', 'wrong')
        .send({ name: 'x' });
      expect(res.status).toBe(403);
    });

    it('rejects a request from a foreign origin', async () => {
      const session = await sessionFor('ownerA');
      const res = await as(app, session, 'post', '/api/projects')
        .set('Origin', 'https://evil.example')
        .send({ name: 'x' });
      expect(res.status).toBe(403);
    });

    it('does not apply to safe methods', async () => {
      const session = await sessionFor('ownerA');
      const res = await request(app)
        .get('/api/projects')
        .set(
          'Cookie',
          Object.entries(session.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; '),
        );
      expect(res.status).toBe(200);
    });
  });
});
