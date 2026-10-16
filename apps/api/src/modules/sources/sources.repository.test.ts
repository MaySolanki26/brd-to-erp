import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: { groupBy: vi.fn(), findMany: vi.fn() },
  contextNote: { groupBy: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  countDocumentsByStatus,
  countNotesByStatus,
  listActiveDocuments,
  listActiveNotes,
} from './sources.repository.js';

describe('sources.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('groups document and note counts inside the organization and project', async () => {
    prismaMock.document.groupBy.mockResolvedValue([{ status: 'FAILED', _count: { _all: 2 } }]);
    prismaMock.contextNote.groupBy.mockResolvedValue([
      { status: 'PROCESSED', _count: { _all: 1 } },
    ]);
    expect(await countDocumentsByStatus('o1', 'p1')).toEqual([{ status: 'FAILED', count: 2 }]);
    expect(await countNotesByStatus('o1', 'p1')).toEqual([{ status: 'PROCESSED', count: 1 }]);
    expect(prismaMock.document.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      deletedAt: null,
    });
    expect(prismaMock.contextNote.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
    });
  });

  it('lists only waiting and running sources, capped', async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.contextNote.findMany.mockResolvedValue([]);
    await listActiveDocuments('o1', 'p1');
    await listActiveNotes('o1', 'p1');
    for (const call of [prismaMock.document.findMany, prismaMock.contextNote.findMany]) {
      const args = call.mock.calls[0]?.[0];
      expect(args.where.status).toEqual({ in: ['UPLOADED', 'PROCESSING'] });
      expect(args.where.organizationId).toBe('o1');
      expect(args.take).toBe(50);
    }
  });
});
