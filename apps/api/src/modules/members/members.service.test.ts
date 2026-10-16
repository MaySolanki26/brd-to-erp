import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);

const repo = vi.hoisted(() => ({
  listMembers: vi.fn(),
  findMember: vi.fn(),
  userExistsInOrg: vi.fn(),
  addMember: vi.fn(),
  updateMemberRole: vi.fn(),
  deleteMember: vi.fn(),
  countOwners: vi.fn(),
  lockProject: vi.fn(),
}));
vi.mock('./members.repository.js', () => repo);
vi.mock('../audit/audit.repository.js', () => ({ createAuditLog: vi.fn() }));

import { addMember, removeMember, updateMemberRole } from './members.service.js';

const actor: UserDto = {
  id: 'u1',
  email: 'e',
  name: 'n',
  organizationId: 'o1',
  orgRole: 'MEMBER',
  mustChangePassword: false,
  role: { id: 'MEMBER', name: 'MEMBER' },
};
const owner = {
  id: 'm1',
  userId: 'u2',
  role: 'OWNER',
  createdAt: new Date(),
  user: { name: 'n', email: 'e' },
};

describe('members.service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('verifies the target user belongs to the same organization before adding', async () => {
    repo.userExistsInOrg.mockResolvedValue(false);
    await expect(addMember(actor, 'p1', { userId: 'x', role: 'VIEWER' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.userExistsInOrg).toHaveBeenCalledWith('o1', 'x');
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  it('locks the project row before checking the owner count', async () => {
    repo.findMember.mockResolvedValue(owner);
    repo.countOwners.mockResolvedValue(1);
    await expect(removeMember(actor, 'p1', 'u2')).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.lockProject.mock.invocationCallOrder[0]).toBeLessThan(
      repo.countOwners.mock.invocationCallOrder[0] ?? 0,
    );
    expect(repo.deleteMember).not.toHaveBeenCalled();
  });

  it('does not count owners when the role stays OWNER', async () => {
    repo.findMember.mockResolvedValue(owner);
    repo.updateMemberRole.mockResolvedValue(owner);
    await updateMemberRole(actor, 'p1', 'u2', { role: 'OWNER' });
    expect(repo.countOwners).not.toHaveBeenCalled();
  });
});
