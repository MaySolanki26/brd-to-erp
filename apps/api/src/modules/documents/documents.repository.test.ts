import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  document: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  documentVersion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  chunk: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  countChunksByVersion,
  createDocument,
  createVersion,
  failDocument,
  fileKeyUsed,
  findDocument,
  findDuplicate,
  findVersionForDownload,
  listChunks,
  listDocuments,
  listVersions,
  lockDocument,
  markUploaded,
  nextVersionNumber,
  requeue,
} from './documents.repository.js';

describe('documents.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    prismaMock.chunk.findMany.mockResolvedValue([]);
    prismaMock.chunk.count.mockResolvedValue(0);
  });

  it('scopes listing and lookup by organization, project and soft delete', async () => {
    await listDocuments({ organizationId: 'o1', projectId: 'p1', page: 2, pageSize: 10 });
    await findDocument('o1', 'p1', 'd1');
    const scope = { organizationId: 'o1', projectId: 'p1', deletedAt: null };
    expect(prismaMock.document.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: scope,
      skip: 10,
      take: 10,
    });
    expect(prismaMock.document.count.mock.calls[0]?.[0].where).toEqual(scope);
    expect(prismaMock.document.findFirst.mock.calls[0]?.[0].where).toEqual({ id: 'd1', ...scope });
  });

  it('never selects file keys or storage details in list and detail queries', async () => {
    await listDocuments({ organizationId: 'o1', projectId: 'p1', page: 1, pageSize: 10 });
    const select = prismaMock.document.findMany.mock.calls[0]?.[0].select;
    expect(JSON.stringify(select)).not.toContain('fileKey');
  });

  it('scopes version queries through the owning document', async () => {
    await listVersions('o1', 'p1', 'd1');
    await findVersionForDownload('o1', 'p1', 'd1', 'v1');
    expect(prismaMock.documentVersion.findMany.mock.calls[0]?.[0].where).toEqual({
      documentId: 'd1',
      organizationId: 'o1',
      document: { projectId: 'p1', deletedAt: null },
    });
    expect(prismaMock.documentVersion.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'v1',
      documentId: 'd1',
      organizationId: 'o1',
      document: { projectId: 'p1', deletedAt: null },
    });
  });

  it('counts chunks per version inside the organization and project', async () => {
    expect((await countChunksByVersion('o1', 'p1', [])).size).toBe(0);
    expect(prismaMock.chunk.groupBy).not.toHaveBeenCalled();

    prismaMock.chunk.groupBy.mockResolvedValue([
      { documentVersionId: 'v1', _count: { _all: 3 } },
      { documentVersionId: null, _count: { _all: 9 } },
    ]);
    const counts = await countChunksByVersion('o1', 'p1', ['v1']);
    expect(counts.get('v1')).toBe(3);
    expect(counts.size).toBe(1);
    expect(prismaMock.chunk.groupBy.mock.calls[0]?.[0].where).toEqual({
      organizationId: 'o1',
      projectId: 'p1',
      documentVersionId: { in: ['v1'] },
    });
  });

  it('pages chunks in order and scopes them', async () => {
    await listChunks({
      organizationId: 'o1',
      projectId: 'p1',
      versionId: 'v1',
      page: 3,
      pageSize: 5,
    });
    expect(prismaMock.chunk.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: 'o1', projectId: 'p1', documentVersionId: 'v1' },
      orderBy: { chunkIndex: 'asc' },
      skip: 10,
      take: 5,
    });
  });

  it('finds duplicates only inside the same project', async () => {
    prismaMock.documentVersion.findFirst.mockResolvedValue({ document: { id: 'd9', title: 'T' } });
    expect(await findDuplicate('o1', 'p1', 'abc')).toEqual({ id: 'd9', title: 'T' });
    expect(prismaMock.documentVersion.findFirst.mock.calls[0]?.[0].where).toEqual({
      contentHash: 'abc',
      organizationId: 'o1',
      document: { projectId: 'p1', deletedAt: null },
    });
    prismaMock.documentVersion.findFirst.mockResolvedValue(null);
    expect(await findDuplicate('o1', 'p1', 'zzz')).toBeNull();
  });

  it('reports whether a file key was already used', async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue({ id: 'v1' });
    expect(await fileKeyUsed('k')).toBe(true);
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);
    expect(await fileKeyUsed('k')).toBe(false);
  });

  it('runs writes on the transaction client', async () => {
    const tx = {
      document: {
        create: vi.fn().mockResolvedValue({ id: 'd1', versions: [{ id: 'v1' }] }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      documentVersion: {
        create: vi.fn().mockResolvedValue({ id: 'v2' }),
        aggregate: vi.fn().mockResolvedValue({ _max: { versionNumber: 2 } }),
      },
    };
    const created = await createDocument(
      {
        title: 't',
        fileName: 'f.pdf',
        mimeType: 'application/pdf',
        projectId: 'p1',
        organizationId: 'o1',
        createdById: 'u1',
        version: { fileKey: 'k', contentHash: 'h', mimeType: 'application/pdf', sizeBytes: 5 },
      },
      tx as never,
    );
    expect(created).toEqual({ id: 'd1', versionId: 'v1' });
    const data = tx.document.create.mock.calls[0]?.[0].data;
    expect(data.status).toBe('UPLOADED');
    expect(data.versions.create).toMatchObject({ versionNumber: 1, organizationId: 'o1' });

    expect(await lockDocument('o1', 'p1', 'd1', tx as never)).toBe(true);
    expect(await nextVersionNumber('d1', tx as never)).toBe(3);
    await createVersion({ documentId: 'd1' } as never, tx as never);
    await markUploaded('d1', { fileName: 'f', mimeType: 'm' }, tx as never);
    expect(tx.document.update.mock.calls[0]?.[0].data).toMatchObject({
      status: 'UPLOADED',
      errorMessage: null,
    });
    expect(prismaMock.document.updateMany).not.toHaveBeenCalled();
  });

  it('requeues only finished documents and fails only waiting ones', async () => {
    prismaMock.document.updateMany.mockResolvedValue({ count: 0 });
    expect(await requeue('o1', 'p1', 'd1')).toBe(false);
    expect(prismaMock.document.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      id: 'd1',
      organizationId: 'o1',
      projectId: 'p1',
      status: { in: ['FAILED', 'PROCESSED'] },
    });

    await failDocument('o1', 'd1', 'why');
    expect(prismaMock.document.updateMany.mock.calls[1]?.[0]).toMatchObject({
      where: { id: 'd1', organizationId: 'o1', status: 'UPLOADED' },
      data: { status: 'FAILED', errorMessage: 'why' },
    });
  });
});
