import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  projectMember: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  addMember,
  countOwners,
  deleteMember,
  findMember,
  listCandidates,
  listMembers,
  lockProject,
  updateMemberRole,
  userExistsInOrg,
} from './members.repository.js';

describe('members.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('scopes list and find by organization and project', async () => {
    await listMembers('o1', 'p1');
    await findMember('o1', 'p1', 'u1');
    expect(prismaMock.projectMember.findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
    });
    expect(prismaMock.projectMember.findFirst.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      userId: 'u1',
    });
  });

  it('never selects password hashes when joining users', async () => {
    await listMembers('o1', 'p1');
    expect(prismaMock.projectMember.findMany.mock.calls[0]?.[0].select.user).toEqual({
      select: { name: true, email: true },
    });
  });

  it('lists only active, non-member users of the organization as candidates', async () => {
    await listCandidates('o1', 'p1');
    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({
      organizationId: 'o1',
      deletedAt: null,
      projectMemberships: { none: { projectId: 'p1' } },
    });
    expect(args.select).toEqual({ id: true, name: true, email: true });
  });

  it('checks user existence inside the organization, ignoring deleted users', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });
    expect(await userExistsInOrg('o1', 'u1')).toBe(true);
    expect(prismaMock.user.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'u1',
      organizationId: 'o1',
      deletedAt: null,
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    expect(await userExistsInOrg('o1', 'u2')).toBe(false);
  });

  it('runs writes, owner counts and the project lock on the transaction client', async () => {
    const tx = {
      projectMember: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
      },
      project: { updateMany: vi.fn() },
    };
    await addMember(
      { organizationId: 'o1', projectId: 'p1', userId: 'u1', role: 'VIEWER' },
      tx as never,
    );
    await updateMemberRole('m1', 'OWNER', tx as never);
    await deleteMember('m1', tx as never);
    expect(await countOwners('o1', 'p1', tx as never)).toBe(2);
    await lockProject('o1', 'p1', tx as never);

    expect(tx.projectMember.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      role: 'OWNER',
    });
    expect(tx.project.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: 'p1',
      organizationId: 'o1',
    });
    expect(tx.projectMember.create).toHaveBeenCalledTimes(1);
  });
});
