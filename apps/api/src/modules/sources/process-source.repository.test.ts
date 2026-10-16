import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  documentVersion: { findFirst: vi.fn() },
  document: { updateMany: vi.fn() },
  contextNote: { findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import type { ChunkInput } from '../../jobs/chunker.js';
import {
  beginDocument,
  beginNote,
  failDocument,
  failNote,
  findNote,
  findVersion,
  finishDocument,
  finishNote,
  releaseDocument,
  releaseNote,
} from './process-source.repository.js';

const chunk: ChunkInput = {
  chunkIndex: 0,
  headingPath: ['A'],
  content: 'text',
  contentHash: 'h',
  chunkKey: 'k',
  tokenCount: 1,
};

interface UpdateArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

function fakeTx(updateCount: number) {
  const order: string[] = [];
  const guard = async (_args: UpdateArgs) => {
    order.push('guard');
    return { count: updateCount };
  };
  return {
    order,
    tx: {
      document: { updateMany: vi.fn(guard) },
      contextNote: { updateMany: vi.fn(guard) },
      chunk: {
        deleteMany: vi.fn(async (_args: { where: Record<string, unknown> }) => {
          order.push('delete');
          return { count: 0 };
        }),
        createMany: vi.fn(async (_args: { data: Record<string, unknown>[] }) => {
          order.push('create');
          return { count: 1 };
        }),
      },
    },
  };
}

describe('process-source.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads a version only through its document, project and organization', async () => {
    prismaMock.documentVersion.findFirst.mockResolvedValue(null);
    expect(
      await findVersion({
        organizationId: 'o1',
        projectId: 'p1',
        documentId: 'd1',
        versionId: 'v1',
      }),
    ).toBeNull();
    expect(prismaMock.documentVersion.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'v1',
      documentId: 'd1',
      organizationId: 'o1',
      document: { id: 'd1', projectId: 'p1', organizationId: 'o1', deletedAt: null },
    });
  });

  it('claims a document only if it is waiting and this is still the newest version', async () => {
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await beginDocument({
        organizationId: 'o1',
        projectId: 'p1',
        documentId: 'd1',
        versionNumber: 2,
      }),
    ).toBe(true);
    expect(prismaMock.document.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: 'd1',
        organizationId: 'o1',
        projectId: 'p1',
        status: 'UPLOADED',
        versions: { none: { versionNumber: { gt: 2 } } },
      },
      data: { status: 'PROCESSING' },
    });
    prismaMock.document.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await beginDocument({
        organizationId: 'o1',
        projectId: 'p1',
        documentId: 'd1',
        versionNumber: 1,
      }),
    ).toBe(false);
  });

  it('marks the document processed before replacing chunks, then deletes before creating', async () => {
    const { tx, order } = fakeTx(1);
    const ok = await finishDocument(
      { organizationId: 'o1', projectId: 'p1', documentId: 'd1', versionId: 'v1', chunks: [chunk] },
      tx as never,
    );
    expect(ok).toBe(true);
    expect(order).toEqual(['guard', 'delete', 'create']);
    expect(tx.document.updateMany.mock.calls[0]?.[0].where).toMatchObject({ status: 'PROCESSING' });
    expect(tx.chunk.deleteMany.mock.calls[0]?.[0].where).toEqual({
      documentVersionId: 'v1',
      organizationId: 'o1',
    });
    expect(tx.chunk.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({
      ...chunk,
      projectId: 'p1',
      organizationId: 'o1',
      documentVersionId: 'v1',
    });
  });

  it('writes no chunks when the document is no longer processing', async () => {
    const { tx, order } = fakeTx(0);
    const ok = await finishDocument(
      { organizationId: 'o1', projectId: 'p1', documentId: 'd1', versionId: 'v1', chunks: [chunk] },
      tx as never,
    );
    expect(ok).toBe(false);
    expect(order).toEqual(['guard']);
  });

  it('finishes a note only if it is unchanged since it was read', async () => {
    const readAt = new Date('2026-01-01T00:00:00Z');
    const { tx, order } = fakeTx(1);
    expect(
      await finishNote(
        { organizationId: 'o1', projectId: 'p1', noteId: 'n1', readAt, chunks: [chunk] },
        tx as never,
      ),
    ).toBe(true);
    expect(tx.contextNote.updateMany.mock.calls[0]?.[0].where).toEqual({
      id: 'n1',
      organizationId: 'o1',
      status: 'PROCESSING',
      updatedAt: readAt,
    });
    expect(order).toEqual(['guard', 'delete', 'create']);
    expect(tx.chunk.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({ contextNoteId: 'n1' });

    const stale = fakeTx(0);
    expect(
      await finishNote(
        { organizationId: 'o1', projectId: 'p1', noteId: 'n1', readAt, chunks: [chunk] },
        stale.tx as never,
      ),
    ).toBe(false);
    expect(stale.order).toEqual(['guard']);
  });

  it('scopes note lookups and claims by organization and project', async () => {
    prismaMock.contextNote.findFirst.mockResolvedValue(null);
    prismaMock.contextNote.updateMany.mockResolvedValue({ count: 1 });
    await findNote({ organizationId: 'o1', projectId: 'p1', noteId: 'n1' });
    await beginNote({ organizationId: 'o1', projectId: 'p1', noteId: 'n1' });
    expect(prismaMock.contextNote.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'n1',
      organizationId: 'o1',
      projectId: 'p1',
    });
    expect(prismaMock.contextNote.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      organizationId: 'o1',
      projectId: 'p1',
      status: 'UPLOADED',
    });
  });

  it('only fails or releases sources that are currently processing', async () => {
    prismaMock.document.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.contextNote.updateMany.mockResolvedValue({ count: 1 });
    await failDocument('o1', 'd1', 'why');
    await failNote('o1', 'n1', 'why');
    await releaseDocument('o1', 'd1');
    await releaseNote('o1', 'n1');
    for (const call of [
      ...prismaMock.document.updateMany.mock.calls,
      ...prismaMock.contextNote.updateMany.mock.calls.slice(1),
    ]) {
      expect(call[0].where.status).toBe('PROCESSING');
      expect(call[0].where.organizationId).toBe('o1');
    }
    expect(prismaMock.document.updateMany.mock.calls[0]?.[0].data).toEqual({
      status: 'FAILED',
      errorMessage: 'why',
    });
    expect(prismaMock.document.updateMany.mock.calls[1]?.[0].data).toEqual({ status: 'UPLOADED' });
  });
});
