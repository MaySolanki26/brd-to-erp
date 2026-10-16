import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env.js', async () => (await import('../../test/test-env.js')).envModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);

const repo = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findSessionByTokenHash: vi.fn(),
  revokeFamily: vi.fn(),
}));
vi.mock('./auth.repository.js', () => repo);
vi.mock('../audit/audit.repository.js', () => ({ createAuditLog: vi.fn() }));

import { getSessionUser, logout, toUserDto } from './auth.service.js';

describe('auth.service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('builds a DTO without credentials and keeps the legacy role shape', () => {
    const dto = toUserDto({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      organizationId: 'o1',
      orgRole: 'ORG_ADMIN',
      ...{ passwordHash: 'secret' },
    });
    expect(dto).toEqual({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      organizationId: 'o1',
      orgRole: 'ORG_ADMIN',
      role: { id: 'ORG_ADMIN', name: 'ORG_ADMIN' },
    });
  });

  it('rejects a session whose user no longer exists', async () => {
    repo.findUserById.mockResolvedValue(null);
    await expect(getSessionUser('gone')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logout is a silent no-op for a missing or unknown token', async () => {
    await logout(undefined);
    repo.findSessionByTokenHash.mockResolvedValue(null);
    await logout('unknown');
    expect(repo.revokeFamily).not.toHaveBeenCalled();
  });
});
