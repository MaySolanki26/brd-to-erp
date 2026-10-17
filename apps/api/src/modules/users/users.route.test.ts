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
  './users.repository.js',
  async () => (await import('../../test/fake-db.js')).usersRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { createApp } from '../../app.js';
import { db } from '../../test/fake-db.js';
import { as, login } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });
const TEMP = 'Temporary-Pass-123';
const NEW_PASSWORD = 'Brand-New-Password-456';

describe('users routes', () => {
  let world: World;

  beforeEach(async () => {
    world = await buildWorld();
  });

  async function adminSession() {
    return login(app, world.adminA.email, PASSWORD);
  }

  async function createMember(email = 'new@test.dev') {
    const session = await adminSession();
    const res = await as(app, session, 'post', '/api/users').send({
      email,
      name: 'New Person',
      orgRole: 'MEMBER',
      tempPassword: TEMP,
    });
    return { session, res };
  }

  it('rejects unauthenticated requests', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });

  it('forbids non-admin members', async () => {
    const session = await login(app, world.ownerA.email, PASSWORD);
    expect((await as(app, session, 'get', '/api/users')).status).toBe(403);
    const res = await as(app, session, 'post', '/api/users').send({
      email: 'x@test.dev',
      name: 'X',
      orgRole: 'MEMBER',
      tempPassword: TEMP,
    });
    expect(res.status).toBe(403);
  });

  it('lists only the admin organization without credentials', async () => {
    const res = await as(app, await adminSession(), 'get', '/api/users');
    expect(res.status).toBe(200);
    const emails = (res.body.users as { email: string }[]).map((u) => u.email);
    expect(emails).toContain(world.ownerA.email);
    expect(emails).not.toContain(world.userB.email);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('creates a user on a temporary password and audits it', async () => {
    const { res } = await createMember();
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'new@test.dev',
      orgRole: 'MEMBER',
      active: true,
      mustChangePassword: true,
    });
    expect(db.audit.some((a) => a.action === 'CREATE' && a.entity === 'User')).toBe(true);
    expect(JSON.stringify(db.audit)).not.toContain(TEMP);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    const session = await adminSession();
    const dup = await as(app, session, 'post', '/api/users').send({
      email: world.ownerA.email,
      name: 'Dup',
      orgRole: 'MEMBER',
      tempPassword: TEMP,
    });
    expect(dup.status).toBe(409);
    const weak = await as(app, session, 'post', '/api/users').send({
      email: 'weak@test.dev',
      name: 'Weak',
      orgRole: 'MEMBER',
      tempPassword: 'short',
    });
    expect(weak.status).toBe(400);
  });

  it('keeps a new user out of the app until they change the temporary password', async () => {
    await createMember();
    const session = await login(app, 'new@test.dev', TEMP);

    expect((await as(app, session, 'get', '/api/projects')).status).toBe(403);

    const wrong = await as(app, session, 'post', '/api/auth/change-password').send({
      currentPassword: 'not-the-password',
      newPassword: NEW_PASSWORD,
    });
    expect(wrong.status).toBe(400);

    const changed = await as(app, session, 'post', '/api/auth/change-password').send({
      currentPassword: TEMP,
      newPassword: NEW_PASSWORD,
    });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    const fresh = await login(app, 'new@test.dev', NEW_PASSWORD);
    expect((await as(app, fresh, 'get', '/api/projects')).status).toBe(200);
    await expect(login(app, 'new@test.dev', TEMP)).rejects.toThrow();
  });

  it('rejects a new password equal to the current one', async () => {
    const session = await adminSession();
    const res = await as(app, session, 'post', '/api/auth/change-password').send({
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('changes roles, and blocks self-demotion and self-deactivation', async () => {
    const session = await adminSession();
    const promoted = await as(app, session, 'patch', `/api/users/${world.ownerA.id}`).send({
      orgRole: 'ORG_ADMIN',
    });
    expect(promoted.status).toBe(200);
    expect(promoted.body.user.orgRole).toBe('ORG_ADMIN');

    const demoteSelf = await as(app, session, 'patch', `/api/users/${world.adminA.id}`).send({
      orgRole: 'MEMBER',
    });
    expect(demoteSelf.status).toBe(403);
    const deactivateSelf = await as(app, session, 'patch', `/api/users/${world.adminA.id}`).send({
      active: false,
    });
    expect(deactivateSelf.status).toBe(403);
  });

  it('deactivates a user, revokes their sessions and blocks login; reactivation restores it', async () => {
    const admin = await adminSession();
    const target = await login(app, world.analystA.email, PASSWORD);

    const off = await as(app, admin, 'patch', `/api/users/${world.analystA.id}`).send({
      active: false,
    });
    expect(off.status).toBe(200);
    expect(off.body.user.active).toBe(false);
    expect((await as(app, target, 'get', '/api/auth/me')).status).toBe(401);
    await expect(login(app, world.analystA.email, PASSWORD)).rejects.toThrow();

    const on = await as(app, admin, 'patch', `/api/users/${world.analystA.id}`).send({
      active: true,
    });
    expect(on.body.user.active).toBe(true);
    await expect(login(app, world.analystA.email, PASSWORD)).resolves.toBeDefined();
  });

  it('cannot see or change users of another organization', async () => {
    const res = await as(app, await adminSession(), 'patch', `/api/users/${world.userB.id}`).send({
      active: false,
    });
    expect(res.status).toBe(404);
    expect(db.users.get(world.userB.id)?.deletedAt).toBeNull();
  });

  it('resets a password to a temporary one, ends the old session and gates the new one', async () => {
    const admin = await adminSession();
    const target = await login(app, world.viewerA.email, PASSWORD);

    const res = await as(app, admin, 'post', `/api/users/${world.viewerA.id}/reset-password`).send({
      tempPassword: TEMP,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
    expect((await as(app, target, 'post', '/api/auth/refresh')).status).toBe(401);
    // Resetting revokes every session, so the old access token stops working at once.
    expect((await as(app, target, 'get', '/api/projects')).status).toBe(401);
    const session = await login(app, world.viewerA.email, TEMP);
    expect((await as(app, session, 'get', '/api/projects')).status).toBe(403);
  });

  it('rejects malformed ids', async () => {
    const res = await as(app, await adminSession(), 'patch', '/api/users/not-a-uuid').send({
      active: false,
    });
    expect(res.status).toBe(400);
  });
});
