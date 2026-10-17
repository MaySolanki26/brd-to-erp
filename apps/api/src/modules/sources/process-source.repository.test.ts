import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  documentVersion: { findFirst: vi.fn() },
  document: { updateMany: vi.fn() },
  contextNote: { findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
const extraction = vi.hoisted(() => ({
  releaseChunkItems: vi.fn(),
  markOlderVersionItems: vi.fn(),
}));
vi.mock('../extraction/extraction.repository.js', () => extraction);

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

interface StoredChunk {
  id: string;
  chunkKey: string;
  chunkIndex: number;
}

type Where = { where: Record<string, unknown> };
type WriteArgs = Where & { data: Record<string, unknown> };

/** A transaction client over one source whose stored chunks and waiting state the test chooses. */
function fakeTx(options: { waiting?: boolean; stored?: StoredChunk[]; pending?: string[] } = {}) {
  const order: string[] = [];
  const waiting = options.waiting ?? true;
  const count = vi.fn(async (_args: Where) => {
    order.push('guard');
    return waiting ? 1 : 0;
  });
  const updateMany = vi.fn(async (_args: WriteArgs) => ({ count: 1 }));
  return {
    order,
    tx: {
      document: { count, updateMany },
      contextNote: { count, updateMany },
      chunk: {
        findMany: vi
          .fn(async (_args: Where) => [] as { id: string }[])
          .mockResolvedValueOnce(options.stored ?? [])
          .mockResolvedValue((options.pending ?? []).map((id) => ({ id }))),
        delete: vi.fn(async (_args: Where) => {
          order.push('delete');
        }),
        update: vi.fn(async (_args: WriteArgs) => {
          order.push('move');
        }),
        updateMany: vi.fn(async (_args: WriteArgs) => {
          order.push('reset');
          return { count: 1 };
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

  describe('finishDocument', () => {
    const params = {
      organizationId: 'o1',
      projectId: 'p1',
      documentId: 'd1',
      versionId: 'v1',
      versionNumber: 1,
      chunks: [chunk],
      reextract: false,
    };

    it('writes nothing when the document is no longer processing', async () => {
      const { tx, order } = fakeTx({ waiting: false });
      expect(await finishDocument(params, tx as never)).toBeNull();
      expect(order).toEqual(['guard']);
      expect(tx.chunk.createMany).not.toHaveBeenCalled();
    });

    it('stores new chunks, leaves the document processing and returns what to extract', async () => {
      const { tx } = fakeTx({ pending: ['c1'] });
      const result = await finishDocument(params, tx as never);
      expect(result).toEqual({ pendingChunkIds: ['c1'], finished: false });
      expect(tx.chunk.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({
        ...chunk,
        projectId: 'p1',
        organizationId: 'o1',
        documentVersionId: 'v1',
      });
      expect(tx.document.updateMany).not.toHaveBeenCalled();
      expect(tx.chunk.findMany.mock.calls[1]?.[0].where).toMatchObject({
        documentVersionId: 'v1',
        extractedAt: null,
      });
    });

    it('marks the document processed at once when no chunk needs reading', async () => {
      const { tx } = fakeTx({ stored: [{ id: 'c0', chunkKey: 'k', chunkIndex: 0 }], pending: [] });
      const result = await finishDocument(params, tx as never);
      expect(result).toEqual({ pendingChunkIds: [], finished: true });
      expect(tx.chunk.createMany.mock.calls[0]?.[0].data).toEqual([]);
      expect(tx.document.updateMany.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'd1', organizationId: 'o1', status: 'PROCESSING' },
        data: { status: 'PROCESSED' },
      });
    });

    it('keeps chunks whose text did not change, so their items and extraction state survive', async () => {
      const { tx } = fakeTx({ stored: [{ id: 'c0', chunkKey: 'k', chunkIndex: 0 }] });
      await finishDocument(params, tx as never);
      expect(tx.chunk.delete).not.toHaveBeenCalled();
      expect(extraction.releaseChunkItems).not.toHaveBeenCalled();
      expect(tx.chunk.createMany.mock.calls[0]?.[0].data).toEqual([]);
    });

    it('forgets earlier extraction on a reprocess, so every chunk is read again', async () => {
      const { tx, order } = fakeTx({ stored: [{ id: 'c0', chunkKey: 'k', chunkIndex: 0 }], pending: ['c0'] });
      await finishDocument({ ...params, reextract: true }, tx as never);
      expect(tx.chunk.updateMany.mock.calls[0]?.[0]).toEqual({
        where: { documentVersionId: 'v1', organizationId: 'o1' },
        data: { extractedAt: null },
      });
      expect(order.indexOf('reset')).toBeGreaterThan(order.indexOf('guard'));
    });

    it('deletes a vanished chunk once its unconfirmed items are gone, before adding new ones', async () => {
      extraction.releaseChunkItems.mockResolvedValue(true);
      const { tx, order } = fakeTx({
        stored: [{ id: 'old', chunkKey: 'gone', chunkIndex: 0 }],
        pending: ['c1'],
      });
      await finishDocument(params, tx as never);
      expect(extraction.releaseChunkItems).toHaveBeenCalledWith(tx, { organizationId: 'o1', projectId: 'p1' }, 'old');
      expect(tx.chunk.delete).toHaveBeenCalledWith({ where: { id: 'old' } });
      expect(order.indexOf('delete')).toBeLessThan(order.indexOf('create'));
    });

    it('keeps a vanished chunk that still holds confirmed items, moved out of the way', async () => {
      extraction.releaseChunkItems.mockResolvedValue(false);
      const { tx } = fakeTx({
        stored: [{ id: 'old', chunkKey: 'gone', chunkIndex: 0 }],
        pending: ['c1'],
      });
      await finishDocument(params, tx as never);
      expect(tx.chunk.delete).not.toHaveBeenCalled();
      expect(tx.chunk.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'old' } });
      expect(tx.chunk.update.mock.calls[0]?.[0].data['chunkIndex']).toBeGreaterThanOrEqual(1_000_000);
    });

    it('puts a chunk back in its place when its old text returns', async () => {
      const { tx } = fakeTx({ stored: [{ id: 'old', chunkKey: 'k', chunkIndex: 1_000_001 }] });
      await finishDocument(params, tx as never);
      expect(tx.chunk.update).toHaveBeenCalledWith({
        where: { id: 'old' },
        data: { chunkIndex: 0 },
      });
    });

    it('marks items from earlier versions for revalidation only from the second version on', async () => {
      const first = fakeTx({ pending: ['c1'] });
      await finishDocument(params, first.tx as never);
      expect(extraction.markOlderVersionItems).not.toHaveBeenCalled();

      const second = fakeTx({ pending: ['c1'] });
      await finishDocument({ ...params, versionNumber: 2 }, second.tx as never);
      expect(extraction.markOlderVersionItems).toHaveBeenCalledWith(
        second.tx,
        { organizationId: 'o1', projectId: 'p1' },
        'd1',
        2,
      );
    });
  });

  describe('finishNote', () => {
    const readAt = new Date('2026-01-01T00:00:00Z');
    const params = { organizationId: 'o1', projectId: 'p1', noteId: 'n1', readAt, chunks: [chunk] };

    it('finishes a note only if it is unchanged since it was read', async () => {
      const { tx } = fakeTx({ pending: ['c1'] });
      expect(await finishNote(params, tx as never)).toEqual({
        pendingChunkIds: ['c1'],
        finished: false,
      });
      expect(tx.contextNote.count.mock.calls[0]?.[0].where).toEqual({
        id: 'n1',
        organizationId: 'o1',
        status: 'PROCESSING',
        updatedAt: readAt,
      });
      expect(tx.chunk.createMany.mock.calls[0]?.[0].data[0]).toMatchObject({ contextNoteId: 'n1' });

      const stale = fakeTx({ waiting: false });
      expect(await finishNote(params, stale.tx as never)).toBeNull();
      expect(stale.order).toEqual(['guard']);
      expect(stale.tx.chunk.createMany).not.toHaveBeenCalled();
    });

    it('is processed at once when nothing needs reading, and never forces a re-read', async () => {
      const { tx } = fakeTx({ stored: [{ id: 'c0', chunkKey: 'k', chunkIndex: 0 }], pending: [] });
      expect(await finishNote(params, tx as never)).toEqual({ pendingChunkIds: [], finished: true });
      expect(tx.contextNote.updateMany.mock.calls[0]?.[0].data).toMatchObject({ status: 'PROCESSED' });
      expect(tx.chunk.updateMany).not.toHaveBeenCalled();
    });
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
