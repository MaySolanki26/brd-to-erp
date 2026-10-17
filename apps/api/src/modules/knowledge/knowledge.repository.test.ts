import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  requirement: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  businessRule: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  module: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  chunk: { count: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  countChunksNeedingReview,
  countModulesByStatus,
  countRequirementsByStatus,
  countRulesByStatus,
  findChunk,
  listModules,
  listRequirements,
  listRules,
} from './knowledge.repository.js';

const base = { organizationId: 'o1', projectId: 'p1', page: 3, pageSize: 10 };

describe('knowledge.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
    for (const model of [prismaMock.requirement, prismaMock.businessRule, prismaMock.module]) {
      model.count.mockResolvedValue(0);
      model.findMany.mockResolvedValue([]);
      model.groupBy.mockResolvedValue([]);
    }
  });

  it('always scopes requirements by organization and project and hides deleted ones', async () => {
    await listRequirements(base);
    expect(prismaMock.requirement.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      deletedAt: null,
    });
    expect(prismaMock.requirement.findMany.mock.calls[0]?.[0]).toMatchObject({
      skip: 20,
      take: 10,
    });
  });

  it('adds status, module, source and search without dropping the tenant scope', async () => {
    await listRequirements({
      ...base,
      status: 'CONFIRMED',
      moduleId: 'm1',
      sourceId: 's1',
      search: 'tax',
    });
    expect(prismaMock.requirement.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      deletedAt: null,
      status: 'CONFIRMED',
      moduleId: 'm1',
      // An item belongs to a source through its first chunk or any chunk it was merged from.
      AND: [
        {
          OR: [
            { sourceChunk: { OR: [{ documentVersion: { documentId: 's1' } }, { contextNoteId: 's1' }] } },
            {
              extraSources: {
                some: {
                  chunk: { OR: [{ documentVersion: { documentId: 's1' } }, { contextNoteId: 's1' }] },
                },
              },
            },
          ],
        },
      ],
      OR: [
        { title: { contains: 'tax', mode: 'insensitive' } },
        { description: { contains: 'tax', mode: 'insensitive' } },
      ],
    });
  });

  it('scopes rules and modules the same way', async () => {
    await listRules({ ...base, status: 'OPEN' });
    expect(prismaMock.businessRule.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      status: 'OPEN',
    });
    await listModules({ ...base, search: 'bil' });
    expect(prismaMock.module.count.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: 'o1',
      projectId: 'p1',
    });
    expect(prismaMock.module.count.mock.calls[0]?.[0].where.OR).toHaveLength(3);
  });

  it('counts requirements per status inside the project, excluding deleted ones', async () => {
    prismaMock.requirement.groupBy.mockResolvedValue([{ status: 'OPEN', _count: { _all: 4 } }]);
    expect(await countRequirementsByStatus('o1', 'p1')).toEqual([{ status: 'OPEN', count: 4 }]);
    expect(prismaMock.requirement.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      deletedAt: null,
    });
  });

  it('counts rules and modules per status inside the project', async () => {
    prismaMock.businessRule.groupBy.mockResolvedValue([{ status: 'ASSUMED', _count: { _all: 1 } }]);
    prismaMock.module.groupBy.mockResolvedValue([{ status: 'OPEN', _count: { _all: 2 } }]);
    expect(await countRulesByStatus('o1', 'p1')).toEqual([{ status: 'ASSUMED', count: 1 }]);
    expect(await countModulesByStatus('o1', 'p1')).toEqual([{ status: 'OPEN', count: 2 }]);
    expect(prismaMock.module.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
    });
  });

  it('counts only flagged chunks of the project', async () => {
    prismaMock.chunk.count.mockResolvedValue(3);
    expect(await countChunksNeedingReview('o1', 'p1')).toBe(3);
    expect(prismaMock.chunk.count.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      needsReview: true,
    });
  });

  it('looks a chunk up by id within the organization and project', async () => {
    prismaMock.chunk.findFirst.mockResolvedValue(null);
    expect(await findChunk('o1', 'p1', 'c1')).toBeNull();
    expect(prismaMock.chunk.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'c1',
      organizationId: 'o1',
      projectId: 'p1',
    });
  });
});
