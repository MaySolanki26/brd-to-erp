import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  countActiveAdmins,
  createUser,
  emailTaken,
  findUser,
  listUsers,
  updateUser,
} from './users.repository.js';

describe('users.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('scopes list and find by organization', async () => {
    await listUsers('o1');
    await findUser('o1', 'u1');
    expect(prismaMock.user.findMany.mock.calls[0]?.[0].where).toEqual({ organizationId: 'o1' });
    expect(prismaMock.user.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'u1',
      organizationId: 'o1',
    });
  });

  it('never selects the password hash', async () => {
    await listUsers('o1');
    await findUser('o1', 'u1');
    for (const call of [prismaMock.user.findMany, prismaMock.user.findFirst]) {
      expect(call.mock.calls[0]?.[0].select).not.toHaveProperty('passwordHash');
    }
  });

  it('checks email uniqueness across all users, including deactivated ones', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    expect(await emailTaken('a@b.c')).toBe(true);
    expect(prismaMock.user.findUnique.mock.calls[0]?.[0].where).toEqual({ email: 'a@b.c' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await emailTaken('z@b.c')).toBe(false);
  });

  it('runs writes and admin counts on the transaction client', async () => {
    const tx = { user: { create: vi.fn(), update: vi.fn(), count: vi.fn() } };
    await createUser(
      { organizationId: 'o1', email: 'a@b.c', name: 'A', orgRole: 'MEMBER', passwordHash: 'h' },
      tx as never,
    );
    await updateUser('u1', { orgRole: 'ORG_ADMIN' }, tx as never);
    await countActiveAdmins('o1', tx as never);
    expect(tx.user.create.mock.calls[0]?.[0].data.mustChangePassword).toBe(true);
    expect(tx.user.update.mock.calls[0]?.[0].where).toEqual({ id: 'u1' });
    expect(tx.user.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      orgRole: 'ORG_ADMIN',
      deletedAt: null,
    });
  });
});
