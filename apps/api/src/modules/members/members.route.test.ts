import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { addMembership, addUser, db } from '../../test/fake-db.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

describe('members API', () => {
  let world: World;
  let owner: Session;

  beforeEach(async () => {
    world = await buildWorld();
    owner = await login(app, world.ownerA.email, PASSWORD);
  });

  function roleOf(userId: string, projectId: string): string | undefined {
    return [...db.members.values()].find((m) => m.userId === userId && m.projectId === projectId)
      ?.role;
  }

  function promote(userId: string, projectId: string): void {
    for (const m of db.members.values()) {
      if (m.userId === userId && m.projectId === projectId) m.role = 'OWNER';
    }
  }

  const members = (projectId: string) => `/api/projects/${projectId}/members`;

  describe('last-owner rule', () => {
    it('refuses to demote the only owner (409)', async () => {
      const res = await as(app, owner, 'patch', `${members(world.p1.id)}/${world.ownerA.id}`).send({
        role: 'ANALYST',
      });
      expect(res.status).toBe(409);
      expect(roleOf(world.ownerA.id, world.p1.id)).toBe('OWNER');
    });

    it('refuses to remove the only owner (409)', async () => {
      const res = await as(app, owner, 'delete', `${members(world.p1.id)}/${world.ownerA.id}`);
      expect(res.status).toBe(409);
      expect(roleOf(world.ownerA.id, world.p1.id)).toBe('OWNER');
    });

    it('allows demoting an owner once a second owner exists, then protects the remaining one', async () => {
      promote(world.analystA.id, world.p1.id);
      const demote = await as(
        app,
        owner,
        'patch',
        `${members(world.p1.id)}/${world.ownerA.id}`,
      ).send({
        role: 'VIEWER',
      });
      expect(demote.status).toBe(200);

      const remaining = await login(app, world.analystA.email, PASSWORD);
      const again = await as(
        app,
        remaining,
        'patch',
        `${members(world.p1.id)}/${world.analystA.id}`,
      ).send({
        role: 'VIEWER',
      });
      expect(again.status).toBe(409);
      const removeLast = await as(
        app,
        remaining,
        'delete',
        `${members(world.p1.id)}/${world.analystA.id}`,
      );
      expect(removeLast.status).toBe(409);
    });

    it('lets an owner step down by removing themselves when another owner exists', async () => {
      const second = addUser({
        email: 'second-owner@test.dev',
        passwordHash: world.ownerA.passwordHash,
        organizationId: world.orgA,
      });
      addMembership(world.p1, second, 'OWNER');
      const res = await as(app, owner, 'delete', `${members(world.p1.id)}/${world.ownerA.id}`);
      expect(res.status).toBe(204);
    });

    it('is enforced for an ORG_ADMIN override too', async () => {
      const admin = await login(app, world.adminA.email, PASSWORD);
      const res = await as(app, admin, 'delete', `${members(world.p2.id)}/${world.ownerA.id}`);
      expect(res.status).toBe(409);
    });

    it('does not restrict changing non-owner roles', async () => {
      const res = await as(app, owner, 'patch', `${members(world.p1.id)}/${world.viewerA.id}`).send(
        {
          role: 'ANALYST',
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('ANALYST');
    });
  });

  describe('add / list', () => {
    it('adds an org user and lists them without sensitive fields', async () => {
      const add = await as(app, owner, 'post', members(world.p1.id)).send({
        userId: world.outsiderA.id,
        role: 'ANALYST',
      });
      expect(add.status).toBe(201);

      const list = await as(app, owner, 'get', members(world.p1.id));
      expect(list.status).toBe(200);
      const emails = (list.body.members as { email: string }[]).map((m) => m.email);
      expect(emails).toContain(world.outsiderA.email);
      expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    });

    it('lists org users who are not yet members as candidates, never across organizations', async () => {
      const res = await as(app, owner, 'get', `${members(world.p1.id)}/candidates`);
      expect(res.status).toBe(200);
      const emails = (res.body.candidates as { email: string }[]).map((c) => c.email);
      expect(emails).toContain(world.outsiderA.email);
      expect(emails).not.toContain(world.analystA.email);
      expect(emails).not.toContain(world.userB.email);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('does not let non-managers list candidates', async () => {
      const analyst = await login(app, world.analystA.email, PASSWORD);
      expect((await as(app, analyst, 'get', `${members(world.p1.id)}/candidates`)).status).toBe(
        403,
      );
    });

    it('returns 409 when the user is already a member', async () => {
      const res = await as(app, owner, 'post', members(world.p1.id)).send({
        userId: world.viewerA.id,
        role: 'VIEWER',
      });
      expect(res.status).toBe(409);
    });

    it('returns 404 for a user who does not exist', async () => {
      const res = await as(app, owner, 'post', members(world.p1.id)).send({
        userId: '7f1b6a3e-5d4c-4b2a-9e8f-1a2b3c4d5e6f',
        role: 'VIEWER',
      });
      expect(res.status).toBe(404);
    });

    it('rejects an invalid role and an invalid user id with 400', async () => {
      const badRole = await as(app, owner, 'post', members(world.p1.id)).send({
        userId: world.outsiderA.id,
        role: 'SUPERUSER',
      });
      const badId = await as(app, owner, 'post', members(world.p1.id)).send({
        userId: 'x',
        role: 'VIEWER',
      });
      expect(badRole.status).toBe(400);
      expect(badId.status).toBe(400);
    });

    it('returns 404 when changing or removing someone who is not a member', async () => {
      const patch = await as(
        app,
        owner,
        'patch',
        `${members(world.p1.id)}/${world.outsiderA.id}`,
      ).send({
        role: 'VIEWER',
      });
      const del = await as(app, owner, 'delete', `${members(world.p1.id)}/${world.outsiderA.id}`);
      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);
    });
  });

  describe('audit log', () => {
    it('records every member write with the actor and organization', async () => {
      await as(app, owner, 'post', members(world.p1.id)).send({
        userId: world.outsiderA.id,
        role: 'VIEWER',
      });
      await as(app, owner, 'patch', `${members(world.p1.id)}/${world.outsiderA.id}`).send({
        role: 'ANALYST',
      });
      await as(app, owner, 'delete', `${members(world.p1.id)}/${world.outsiderA.id}`);

      const entries = db.audit.filter((a) => a.entity === 'ProjectMember');
      expect(entries.map((a) => a.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
      for (const entry of entries) {
        expect(entry.userId).toBe(world.ownerA.id);
        expect(entry.organizationId).toBe(world.orgA);
      }
      expect(entries[1]?.metadata).toMatchObject({ previousRole: 'VIEWER', role: 'ANALYST' });
    });

    it('does not audit rejected writes', async () => {
      await as(app, owner, 'delete', `${members(world.p1.id)}/${world.ownerA.id}`);
      expect(db.audit.filter((a) => a.entity === 'ProjectMember')).toHaveLength(0);
    });
  });
});
