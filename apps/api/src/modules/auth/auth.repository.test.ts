import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), update: vi.fn() },
  refreshSession: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  createSession,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  incrementFailedLogins,
  lockUser,
  resetFailedLogins,
  revokeFamily,
  revokeSessionIfActive,
} from './auth.repository.js';

describe('auth.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('finds only non-deleted users', async () => {
    await findUserByEmail('a@b.c');
    await findUserById('u1');
    expect(prismaMock.user.findFirst.mock.calls[0]?.[0].where).toEqual({
      email: 'a@b.c',
      deletedAt: null,
    });
    expect(prismaMock.user.findFirst.mock.calls[1]?.[0].where).toEqual({
      id: 'u1',
      deletedAt: null,
    });
  });

  it('increments failures atomically and returns the new count', async () => {
    prismaMock.user.update.mockResolvedValue({ failedLoginCount: 3 });
    expect(await incrementFailedLogins('u1')).toBe(3);
    expect(prismaMock.user.update.mock.calls[0]?.[0].data).toEqual({
      failedLoginCount: { increment: 1 },
    });
  });

  it('locks and resets', async () => {
    const until = new Date();
    await lockUser('u1', until);
    await resetFailedLogins('u1');
    expect(prismaMock.user.update.mock.calls[0]?.[0].data).toEqual({
      lockedUntil: until,
      failedLoginCount: 0,
    });
    expect(prismaMock.user.update.mock.calls[1]?.[0].data).toEqual({
      failedLoginCount: 0,
      lockedUntil: null,
    });
  });

  it('stores only the token hash for a session', async () => {
    await createSession({
      tokenHash: 'h',
      familyId: 'f',
      userId: 'u1',
      organizationId: 'o1',
      expiresAt: new Date(),
    });
    const data = prismaMock.refreshSession.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ tokenHash: 'h', userAgent: null, ip: null });
    expect(Object.keys(data)).not.toContain('token');
  });

  it('looks sessions up by hash', async () => {
    await findSessionByTokenHash('h');
    expect(prismaMock.refreshSession.findUnique.mock.calls[0]?.[0].where).toEqual({
      tokenHash: 'h',
    });
  });

  it('revokes a session only if still active and reports whether it won', async () => {
    prismaMock.refreshSession.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const now = new Date();
    expect(await revokeSessionIfActive('s1', now)).toBe(true);
    expect(await revokeSessionIfActive('s1', now)).toBe(false);
    expect(prismaMock.refreshSession.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: 's1',
      revokedAt: null,
    });
  });

  it('revokes every active session in a family', async () => {
    const now = new Date();
    await revokeFamily('f1', now);
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'f1', revokedAt: null },
      data: { revokedAt: now },
    });
  });
});
