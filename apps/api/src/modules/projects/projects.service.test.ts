import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);
vi.mock('../access/access.repository.js', () => ({ projectSelect: {} }));

const repo = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  addOwner: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock('./projects.repository.js', () => repo);
const audit = vi.hoisted(() => ({ createAuditLog: vi.fn() }));
vi.mock('../audit/audit.repository.js', () => audit);

import {
  archiveProject,
  createProject,
  listProjects,
  toProjectDto,
  updateProject,
} from './projects.service.js';

const now = new Date('2026-01-01T00:00:00Z');
const record = {
  id: 'p1',
  name: 'N',
  description: null,
  status: 'ACTIVE' as const,
  organizationId: 'o1',
  createdAt: now,
  updatedAt: now,
};
const user = (orgRole: 'ORG_ADMIN' | 'MEMBER'): UserDto => ({
  id: 'u1',
  email: 'e',
  name: 'n',
  organizationId: 'o1',
  orgRole,
  role: { id: orgRole, name: orgRole },
});

describe('projects.service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('serialises dates and the caller role', () => {
    expect(toProjectDto(record, 'VIEWER')).toMatchObject({
      createdAt: now.toISOString(),
      myRole: 'VIEWER',
    });
  });

  it('lists every project in the org for ORG_ADMIN and only memberships for members', async () => {
    repo.listProjects.mockResolvedValue({ items: [], total: 0 });
    await listProjects(user('ORG_ADMIN'), { page: 1, pageSize: 20, includeArchived: false });
    await listProjects(user('MEMBER'), { page: 1, pageSize: 20, includeArchived: false });
    expect(
      repo.listProjects.mock.calls.map((c) => (c[0] as { allInOrg: boolean }).allInOrg),
    ).toEqual([true, false]);
  });

  it('creates the project, its owner membership and an audit entry together', async () => {
    repo.createProject.mockResolvedValue(record);
    const dto = await createProject(user('MEMBER'), { name: 'N' });
    expect(repo.addOwner).toHaveBeenCalledWith(
      { projectId: 'p1', userId: 'u1', organizationId: 'o1' },
      expect.anything(),
    );
    expect(audit.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' }),
      expect.anything(),
    );
    expect(dto.myRole).toBe('OWNER');
  });

  it('refuses to update an archived project', async () => {
    await expect(
      updateProject(
        user('MEMBER'),
        { project: { ...record, status: 'ARCHIVED' }, role: 'OWNER' },
        { name: 'x' },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.updateProject).not.toHaveBeenCalled();
  });

  it('archiving an archived project writes nothing', async () => {
    await archiveProject(user('MEMBER'), {
      project: { ...record, status: 'ARCHIVED' },
      role: 'OWNER',
    });
    expect(repo.updateProject).not.toHaveBeenCalled();
    expect(audit.createAuditLog).not.toHaveBeenCalled();
  });
});
