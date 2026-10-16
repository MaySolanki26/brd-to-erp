import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

const repo = vi.hoisted(() => ({ findProjectInOrg: vi.fn(), findMembershipRole: vi.fn() }));
vi.mock('./access.repository.js', () => repo);

import { resolveProjectAccess } from './access.service.js';

const project = { id: 'p1', organizationId: 'o1' };

function user(orgRole: 'ORG_ADMIN' | 'MEMBER'): UserDto {
  return {
    id: 'u1',
    email: 'e',
    name: 'n',
    organizationId: 'o1',
    orgRole,
    mustChangePassword: false,
    role: { id: orgRole, name: orgRole },
  };
}

describe('resolveProjectAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.findProjectInOrg.mockResolvedValue(project);
  });

  it('scopes the project lookup by the caller organization', async () => {
    repo.findMembershipRole.mockResolvedValue('OWNER');
    await resolveProjectAccess(user('MEMBER'), 'p1', ['OWNER']);
    expect(repo.findProjectInOrg).toHaveBeenCalledWith('o1', 'p1');
    expect(repo.findMembershipRole).toHaveBeenCalledWith('o1', 'p1', 'u1');
  });

  it('404s when the project is not in the org', async () => {
    repo.findProjectInOrg.mockResolvedValue(null);
    await expect(resolveProjectAccess(user('ORG_ADMIN'), 'p1', ['VIEWER'])).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('404s for a non-member and 403s for a member with too low a role', async () => {
    repo.findMembershipRole.mockResolvedValueOnce(null);
    await expect(resolveProjectAccess(user('MEMBER'), 'p1', ['VIEWER'])).rejects.toMatchObject({
      statusCode: 404,
    });
    repo.findMembershipRole.mockResolvedValueOnce('VIEWER');
    await expect(resolveProjectAccess(user('MEMBER'), 'p1', ['OWNER'])).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('lets ORG_ADMIN through regardless of membership', async () => {
    repo.findMembershipRole.mockResolvedValue(null);
    await expect(resolveProjectAccess(user('ORG_ADMIN'), 'p1', ['OWNER'])).resolves.toEqual({
      project,
      role: null,
    });
  });
});
