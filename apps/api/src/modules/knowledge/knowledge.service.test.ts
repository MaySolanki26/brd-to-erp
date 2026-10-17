import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@brd/shared';

const repo = vi.hoisted(() => ({
  listRequirements: vi.fn(),
  listRules: vi.fn(),
  listModules: vi.fn(),
  countRequirementsByStatus: vi.fn(),
  countRulesByStatus: vi.fn(),
  countModulesByStatus: vi.fn(),
  countChunksNeedingReview: vi.fn(),
  findChunk: vi.fn(),
}));
vi.mock('./knowledge.repository.js', () => repo);

import { getChunk, getSummary, listModules, listRequirements } from './knowledge.service.js';

const user = { id: 'u1', organizationId: 'o1' } as UserDto;
const date = new Date('2026-01-02T03:04:05.000Z');
const docChunk = {
  id: 'c1',
  headingPath: ['A', 'B'],
  needsReview: true,
  documentVersion: { versionNumber: 3, document: { id: 'd1', title: 'Doc' } },
  contextNote: null,
};
const query = { page: 1, pageSize: 20 };

describe('knowledge.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passes the caller organization to every query, not anything from the request', async () => {
    repo.listRequirements.mockResolvedValue({ items: [], total: 0 });
    await listRequirements(user, 'p1', { ...query, status: 'OPEN' });
    expect(repo.listRequirements).toHaveBeenCalledWith({
      ...query,
      status: 'OPEN',
      organizationId: 'o1',
      projectId: 'p1',
    });
  });

  it('maps an item, naming the AI as author when nobody created it', async () => {
    repo.listRequirements.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'r1',
          title: 'T',
          description: 'D',
          status: 'NEEDS_REVALIDATION',
          priority: 2,
          createdAt: date,
          updatedAt: date,
          module: null,
          createdBy: null,
          sourceChunk: docChunk,
        },
      ],
    });
    const result = await listRequirements(user, 'p1', query);
    expect(result.items[0]).toMatchObject({
      id: 'r1',
      createdBy: 'AI',
      createdAt: '2026-01-02T03:04:05.000Z',
      source: {
        chunkId: 'c1',
        type: 'document',
        sourceId: 'd1',
        versionNumber: 3,
        needsReview: true,
      },
    });
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  });

  it('maps a note source without a version', async () => {
    repo.listModules.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'm1',
          name: 'Billing',
          code: 'BIL',
          description: null,
          status: 'OPEN',
          createdAt: date,
          updatedAt: date,
          createdBy: { id: 'u2', name: 'Ann' },
          _count: { requirements: 4 },
          sourceChunk: {
            id: 'c2',
            headingPath: [],
            needsReview: false,
            documentVersion: null,
            contextNote: { id: 'n1', title: 'Call' },
          },
        },
      ],
    });
    const result = await listModules(user, 'p1', query);
    expect(result.items[0]).toMatchObject({
      requirementCount: 4,
      createdBy: { id: 'u2', name: 'Ann' },
      source: { type: 'note', sourceId: 'n1', sourceTitle: 'Call', versionNumber: null },
    });
  });

  it('fills missing statuses with zero in the summary', async () => {
    repo.countRequirementsByStatus.mockResolvedValue([{ status: 'CONFIRMED', count: 3 }]);
    repo.countRulesByStatus.mockResolvedValue([]);
    repo.countModulesByStatus.mockResolvedValue([{ status: 'OPEN', count: 1 }]);
    repo.countChunksNeedingReview.mockResolvedValue(2);
    const summary = await getSummary(user, 'p1');
    expect(summary.counts.requirements).toEqual({
      CONFIRMED: 3,
      ASSUMED: 0,
      OPEN: 0,
      REJECTED: 0,
      NEEDS_REVALIDATION: 0,
    });
    expect(summary.counts.rules.OPEN).toBe(0);
    expect(summary.counts.modules.OPEN).toBe(1);
    expect(summary.chunksNeedingReview).toBe(2);
  });

  it('throws NotFound for a chunk outside the project', async () => {
    repo.findChunk.mockResolvedValue(null);
    await expect(getChunk(user, 'p1', 'c9')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findChunk).toHaveBeenCalledWith('o1', 'p1', 'c9');
  });

  it('returns the chunk text and its source', async () => {
    repo.findChunk.mockResolvedValue({ ...docChunk, chunkIndex: 5, content: 'Exact text' });
    expect(await getChunk(user, 'p1', 'c1')).toEqual({
      id: 'c1',
      chunkIndex: 5,
      headingPath: ['A', 'B'],
      content: 'Exact text',
      needsReview: true,
      source: { type: 'document', sourceId: 'd1', sourceTitle: 'Doc', versionNumber: 3 },
    });
  });
});
