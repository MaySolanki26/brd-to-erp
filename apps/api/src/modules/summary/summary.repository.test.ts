import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  projectSummary: { findMany: vi.fn(), findFirst: vi.fn() },
  requirement: { findMany: vi.fn() },
  businessRule: { findMany: vi.fn() },
  module: { findMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { findItemTitles, findSummary, listVersions } from './summary.repository.js';

const scope = { organizationId: 'o1', projectId: 'p1' };

describe('summary.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.requirement.findMany.mockResolvedValue([]);
    prismaMock.businessRule.findMany.mockResolvedValue([]);
    prismaMock.module.findMany.mockResolvedValue([]);
  });

  it('lists versions for the project, newest first and bounded', async () => {
    prismaMock.projectSummary.findMany.mockResolvedValue([]);
    await listVersions('o1', 'p1');
    expect(prismaMock.projectSummary.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: scope,
      select: { version: true, generatedAt: true },
      orderBy: { version: 'desc' },
      take: 100,
    });
  });

  it('finds the newest summary, or a specific version, inside the project', async () => {
    prismaMock.projectSummary.findFirst.mockResolvedValue(null);
    await findSummary('o1', 'p1');
    await findSummary('o1', 'p1', 3);
    expect(prismaMock.projectSummary.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: scope,
      orderBy: { version: 'desc' },
    });
    expect(prismaMock.projectSummary.findFirst.mock.calls[1]?.[0].where).toEqual({
      ...scope,
      version: 3,
    });
  });

  it('looks titles up in one query per kind, scoped to the project, and skips empty kinds', async () => {
    prismaMock.requirement.findMany.mockResolvedValue([{ id: 'r1', title: 'Req' }]);
    prismaMock.module.findMany.mockResolvedValue([{ id: 'm1', name: 'Mod' }]);
    const titles = await findItemTitles('o1', 'p1', {
      requirements: ['r1'],
      rules: [],
      modules: ['m1'],
    });

    expect(titles.get('requirement:r1')).toBe('Req');
    expect(titles.get('module:m1')).toBe('Mod');
    expect(prismaMock.businessRule.findMany).not.toHaveBeenCalled();
    expect(prismaMock.requirement.findMany.mock.calls[0]?.[0].where).toEqual({
      ...scope,
      id: { in: ['r1'] },
      deletedAt: null,
    });
    expect(prismaMock.module.findMany.mock.calls[0]?.[0].where).toEqual({
      ...scope,
      id: { in: ['m1'] },
    });
  });
});
