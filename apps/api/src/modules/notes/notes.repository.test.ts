import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  contextNote: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  chunk: { groupBy: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  countChunksByNote,
  createNote,
  failNote,
  findNote,
  listNotes,
  updateNote,
} from './notes.repository.js';

describe('notes.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.contextNote.findMany.mockResolvedValue([]);
    prismaMock.contextNote.count.mockResolvedValue(0);
  });

  it('scopes list and find by organization and project', async () => {
    await listNotes({ organizationId: 'o1', projectId: 'p1', page: 1, pageSize: 20 });
    await findNote('o1', 'p1', 'n1');
    expect(prismaMock.contextNote.findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
    });
    expect(prismaMock.contextNote.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'n1',
      organizationId: 'o1',
      projectId: 'p1',
    });
  });

  it('counts chunks per note inside the organization and project', async () => {
    expect((await countChunksByNote('o1', 'p1', [])).size).toBe(0);
    expect(prismaMock.chunk.groupBy).not.toHaveBeenCalled();
    prismaMock.chunk.groupBy.mockResolvedValue([{ contextNoteId: 'n1', _count: { _all: 2 } }]);
    expect((await countChunksByNote('o1', 'p1', ['n1'])).get('n1')).toBe(2);
    expect(prismaMock.chunk.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      contextNoteId: { in: ['n1'] },
    });
  });

  it('puts an edited note back in the queue on the transaction client', async () => {
    const tx = { contextNote: { create: vi.fn(), update: vi.fn() } };
    await createNote(
      { title: 't', body: 'b', projectId: 'p1', organizationId: 'o1', createdById: 'u1' },
      tx as never,
    );
    await updateNote('n1', { body: 'new' }, tx as never);
    expect(tx.contextNote.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'n1' },
      data: { body: 'new', status: 'UPLOADED', errorMessage: null },
    });
  });

  it('fails only notes that are still waiting', async () => {
    await failNote('o1', 'n1', 'why');
    expect(prismaMock.contextNote.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'n1', organizationId: 'o1', status: 'UPLOADED' },
      data: { status: 'FAILED', errorMessage: 'why' },
    });
  });
});
