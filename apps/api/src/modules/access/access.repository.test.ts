import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  projectMember: { findFirst: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { findMembershipRole, findProjectInOrg } from './access.repository.js';

describe('access.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('scopes project lookups by organizationId', async () => {
    await findProjectInOrg('o1', 'p1');
    expect(prismaMock.project.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'p1',
      organizationId: 'o1',
    });
  });

  it('scopes membership lookups by organization, project and user', async () => {
    prismaMock.projectMember.findFirst.mockResolvedValue({ role: 'ANALYST' });
    expect(await findMembershipRole('o1', 'p1', 'u1')).toBe('ANALYST');
    expect(prismaMock.projectMember.findFirst.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      userId: 'u1',
    });
  });

  it('returns null for a non-member', async () => {
    prismaMock.projectMember.findFirst.mockResolvedValue(null);
    expect(await findMembershipRole('o1', 'p1', 'u1')).toBeNull();
  });
});
