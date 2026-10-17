import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  project: { count: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { addOwner, createProject, listProjects, updateProject } from './projects.repository.js';

const base = { organizationId: 'o1', userId: 'u1', includeArchived: false, page: 2, pageSize: 10 };

describe('projects.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
    prismaMock.project.count.mockResolvedValue(0);
    prismaMock.project.findMany.mockResolvedValue([]);
  });

  it('limits members to projects they belong to, scoped by organization', async () => {
    await listProjects({ ...base, allInOrg: false });
    expect(prismaMock.project.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      members: { some: { userId: 'u1' } },
      status: { not: 'ARCHIVED' },
    });
  });

  it('lets org admins see every project in their organization only', async () => {
    await listProjects({ ...base, allInOrg: true, includeArchived: true });
    expect(prismaMock.project.count.mock.calls[0]?.[0].where).toEqual({ organizationId: 'o1' });
  });

  it('filters by a case-insensitive name match without widening the tenant or membership scope', async () => {
    await listProjects({ ...base, allInOrg: false, search: 'alp' });
    expect(prismaMock.project.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      members: { some: { userId: 'u1' } },
      status: { not: 'ARCHIVED' },
      name: { contains: 'alp', mode: 'insensitive' },
    });
  });

  it('paginates and flattens the membership into myRole', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'p1', members: [{ role: 'VIEWER' }] },
      { id: 'p2', members: [] },
    ]);
    const { items } = await listProjects({ ...base, allInOrg: true });
    expect(prismaMock.project.findMany.mock.calls[0]?.[0]).toMatchObject({ skip: 10, take: 10 });
    expect(items.map((i) => i.myRole)).toEqual(['VIEWER', null]);
  });

  it('creates projects and owners through the supplied transaction client', async () => {
    const tx = {
      project: { create: vi.fn().mockResolvedValue({ id: 'p1' }) },
      projectMember: { create: vi.fn() },
    };
    await createProject({ name: 'N', organizationId: 'o1' }, tx as never);
    await addOwner({ projectId: 'p1', userId: 'u1', organizationId: 'o1' }, tx as never);
    expect(tx.project.create.mock.calls[0]?.[0].data).toMatchObject({
      organizationId: 'o1',
      status: 'ACTIVE',
    });
    expect(tx.projectMember.create.mock.calls[0]?.[0].data).toMatchObject({ role: 'OWNER' });
  });

  it('updates only inside the organization and returns null when nothing matched', async () => {
    const tx = {
      project: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findFirst: vi.fn() },
    };
    expect(await updateProject('o1', 'p1', { name: 'x' }, tx as never)).toBeNull();
    expect(tx.project.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: 'p1',
      organizationId: 'o1',
    });
    expect(tx.project.findFirst).not.toHaveBeenCalled();
  });
});
