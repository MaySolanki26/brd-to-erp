import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

const repo = vi.hoisted(() => ({
  listUsers: vi.fn(),
  findUser: vi.fn(),
  emailTaken: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  countActiveAdmins: vi.fn(),
}));
const authRepo = vi.hoisted(() => ({ updatePassword: vi.fn(), revokeAllSessions: vi.fn() }));
vi.mock('./users.repository.js', () => repo);
vi.mock('../auth/auth.repository.js', () => authRepo);
vi.mock('../audit/audit.repository.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('../../lib/transaction.js', () => ({
  withTransaction: <T>(fn: (tx: object) => Promise<T>) => fn({}),
}));
vi.mock('../../lib/password.js', () => ({ hashPassword: vi.fn(async () => 'hashed') }));

import { createUser, resetPassword, updateUser } from './users.service.js';

const actor: UserDto = {
  id: 'admin',
  email: 'a@x.y',
  name: 'A',
  organizationId: 'o1',
  orgRole: 'ORG_ADMIN',
  mustChangePassword: false,
  role: { id: 'ORG_ADMIN', name: 'ORG_ADMIN' },
};

function record(over: Partial<{ id: string; orgRole: string; deletedAt: Date | null }> = {}) {
  return {
    id: 'u2',
    email: 'u2@x.y',
    name: 'U2',
    orgRole: 'MEMBER',
    mustChangePassword: false,
    deletedAt: null,
    createdAt: new Date(0),
    ...over,
  };
}

describe('users.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.updateUser.mockImplementation(async () => record());
  });

  it('refuses to create a user whose email is already registered', async () => {
    repo.emailTaken.mockResolvedValue(true);
    await expect(
      createUser(actor, {
        email: 'u2@x.y',
        name: 'U2',
        orgRole: 'MEMBER',
        tempPassword: 'x'.repeat(12),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('stores only a hash of the temporary password', async () => {
    repo.emailTaken.mockResolvedValue(false);
    repo.createUser.mockResolvedValue(record());
    await createUser(actor, {
      email: 'u2@x.y',
      name: 'U2',
      orgRole: 'MEMBER',
      tempPassword: 'plain-temp-password',
    });
    const data = repo.createUser.mock.calls[0]?.[0];
    expect(data.passwordHash).toBe('hashed');
    expect(JSON.stringify(data)).not.toContain('plain-temp-password');
  });

  it('returns 404 for users outside the organization', async () => {
    repo.findUser.mockResolvedValue(null);
    await expect(updateUser(actor, 'nope', { active: false })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('blocks changing your own role or active state', async () => {
    repo.findUser.mockResolvedValue(record({ id: 'admin', orgRole: 'ORG_ADMIN' }));
    await expect(updateUser(actor, 'admin', { orgRole: 'MEMBER' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(updateUser(actor, 'admin', { active: false })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('keeps at least one active admin', async () => {
    repo.findUser.mockResolvedValue(record({ orgRole: 'ORG_ADMIN' }));
    repo.countActiveAdmins.mockResolvedValue(1);
    await expect(updateUser(actor, 'u2', { orgRole: 'MEMBER' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.updateUser).not.toHaveBeenCalled();
  });

  it('allows demoting an admin when another admin remains', async () => {
    repo.findUser.mockResolvedValue(record({ orgRole: 'ORG_ADMIN' }));
    repo.countActiveAdmins.mockResolvedValue(2);
    await updateUser(actor, 'u2', { orgRole: 'MEMBER' });
    expect(repo.updateUser.mock.calls[0]?.[1]).toEqual({ orgRole: 'MEMBER' });
  });

  it('revokes all sessions when deactivating, and none for a role change', async () => {
    repo.findUser.mockResolvedValue(record());
    await updateUser(actor, 'u2', { active: false });
    expect(authRepo.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(repo.updateUser.mock.calls[0]?.[1].deletedAt).toBeInstanceOf(Date);

    authRepo.revokeAllSessions.mockClear();
    await updateUser(actor, 'u2', { orgRole: 'ORG_ADMIN' });
    expect(authRepo.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('reactivates by clearing deletedAt', async () => {
    repo.findUser.mockResolvedValue(record({ deletedAt: new Date() }));
    await updateUser(actor, 'u2', { active: true });
    expect(repo.updateUser.mock.calls[0]?.[1].deletedAt).toBeNull();
  });

  it('resets passwords as temporary and refuses self or deactivated targets', async () => {
    repo.findUser.mockResolvedValue(record());
    await resetPassword(actor, 'u2', { tempPassword: 'x'.repeat(12) });
    expect(authRepo.updatePassword).toHaveBeenCalledWith('u2', 'hashed', true, {});
    expect(authRepo.revokeAllSessions).toHaveBeenCalled();

    repo.findUser.mockResolvedValue(record({ id: 'admin' }));
    await expect(
      resetPassword(actor, 'admin', { tempPassword: 'x'.repeat(12) }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    repo.findUser.mockResolvedValue(record({ deletedAt: new Date() }));
    await expect(
      resetPassword(actor, 'u2', { tempPassword: 'x'.repeat(12) }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
