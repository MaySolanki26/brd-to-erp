import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({ chunk: { findFirst: vi.fn() } }));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  applyPlan,
  failSourceOfChunk,
  finishSourceIfDone,
  findChunk,
  loadExisting,
  lockProject,
  markExtracted,
  markOlderVersionItems,
  releaseChunkItems,
} from './extraction.repository.js';
import type { ExtractionPlan } from './extraction.types.js';

const scope = { organizationId: 'o1', projectId: 'p1' };
type Args = Record<string, unknown>;
const call = (mock: ReturnType<typeof vi.fn>, n = 0): Args =>
  (mock.mock.calls[n]?.[0] ?? {}) as Args;

const emptyPlan: ExtractionPlan = {
  create: [],
  link: [],
  update: [],
  remove: [],
  unlink: [],
  revalidate: [],
};

/** A transaction client whose every method is a mock returning harmless defaults. */
function fakeTx() {
  const model = () => ({
    findMany: vi.fn(async (_a?: Args) => [] as Args[]),
    findFirst: vi.fn(async (_a?: Args) => null as Args | null),
    create: vi.fn(async (_a?: Args) => ({ id: 'new-id' })),
    createMany: vi.fn(async (_a?: Args) => ({ count: 0 })),
    updateMany: vi.fn(async (_a?: Args) => ({ count: 1 })),
    deleteMany: vi.fn(async (_a?: Args) => ({ count: 1 })),
    count: vi.fn(async (_a?: Args) => 0),
  });
  return {
    $executeRaw: vi.fn(async () => 1),
    module: model(),
    requirement: model(),
    businessRule: model(),
    itemSource: model(),
    chunk: model(),
    document: model(),
    contextNote: model(),
  };
}

describe('extraction.repository', () => {
  beforeEach(() => vi.resetAllMocks());

  describe('findChunk', () => {
    it('finds a chunk only inside its organization and project', async () => {
      prismaMock.chunk.findFirst.mockResolvedValue(null);
      expect(await findChunk('o1', 'p1', 'c1')).toBeNull();
      expect(call(prismaMock.chunk.findFirst)['where']).toEqual({
        id: 'c1',
        organizationId: 'o1',
        projectId: 'p1',
      });
    });

    it('is current for a note chunk and for the newest version of a document only', async () => {
      const row = (versionNumber: number, newest: number) => ({
        id: 'c1',
        content: 'text',
        headingPath: ['A'],
        documentVersion: { versionNumber, document: { versions: [{ versionNumber: newest }] } },
      });
      prismaMock.chunk.findFirst.mockResolvedValueOnce({
        id: 'c1',
        content: 't',
        headingPath: [],
        documentVersion: null,
      });
      expect((await findChunk('o1', 'p1', 'c1'))?.current).toBe(true);
      prismaMock.chunk.findFirst.mockResolvedValueOnce(row(2, 2));
      expect((await findChunk('o1', 'p1', 'c1'))?.current).toBe(true);
      prismaMock.chunk.findFirst.mockResolvedValueOnce(row(1, 2));
      expect((await findChunk('o1', 'p1', 'c1'))?.current).toBe(false);
    });
  });

  it('takes a transaction-scoped advisory lock keyed by project', async () => {
    const tx = fakeTx();
    await lockProject(tx as never, 'p1');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  describe('loadExisting', () => {
    it('reads only this organization and project, and only items the drafts match or the chunk touches', async () => {
      const tx = fakeTx();
      await loadExisting(tx as never, scope, 'c1', {
        modules: [{ name: 'Billing', description: '' }],
        requirements: [{ title: 'Send invoices', description: '', moduleName: null }],
        rules: [],
      });
      const requirements = call(tx.requirement.findMany)['where'] as Args;
      expect(requirements).toMatchObject({ ...scope, deletedAt: null });
      expect(JSON.stringify(requirements)).toContain('"sourceChunkId":"c1"');
      expect(JSON.stringify(requirements)).toContain(
        '"title":{"equals":"send invoices","mode":"insensitive"}',
      );
      expect(call(tx.module.findMany)['where']).toMatchObject(scope);
      // No rule drafts: rules are read only for what this chunk already owns or links.
      expect(JSON.stringify(call(tx.businessRule.findMany)['where'])).not.toContain('equals');
    });

    it('reports where each stored item stands against this chunk', async () => {
      const tx = fakeTx();
      tx.requirement.findMany.mockResolvedValue([
        {
          id: 'r1',
          title: 'Send invoices',
          description: 'D',
          status: 'OPEN',
          createdById: null,
          moduleId: 'm1',
          sourceChunkId: 'c1',
          extraSources: [{ chunkId: 'c9' }],
        },
        {
          id: 'r2',
          title: 'Other',
          description: 'D',
          status: 'OPEN',
          createdById: null,
          moduleId: null,
          sourceChunkId: 'c5',
          extraSources: [{ chunkId: 'c1' }, { chunkId: 'c6' }],
        },
      ]);
      const result = await loadExisting(tx as never, scope, 'c1', {
        modules: [],
        requirements: [],
        rules: [],
      });
      expect(result.requirement).toEqual([
        expect.objectContaining({
          id: 'r1',
          ownedHere: true,
          linkedHere: false,
          otherSourceChunkIds: ['c9'],
        }),
        expect.objectContaining({
          id: 'r2',
          ownedHere: false,
          linkedHere: true,
          otherSourceChunkIds: ['c6'],
        }),
      ]);
    });
  });

  describe('applyPlan', () => {
    it('creates a module with a code made from its name, unique within the project', async () => {
      const tx = fakeTx();
      tx.module.findMany.mockResolvedValue([{ id: 'm0', name: 'Billing', code: 'BILLING' }]);
      await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        create: [
          { kind: 'module', title: 'Billing & Payments', description: 'D', moduleName: null },
          { kind: 'module', title: 'billing', description: '', moduleName: null },
        ],
      });
      const first = call(tx.module.create, 0)['data'] as Args;
      const second = call(tx.module.create, 1)['data'] as Args;
      expect(first).toMatchObject({
        ...scope,
        name: 'Billing & Payments',
        code: 'BILLING-PAYMENTS',
        sourceChunkId: 'c1',
        createdById: null,
      });
      expect(second['code']).toBe('BILLING-2');
    });

    it('creates requirements and rules for the pipeline, tied to the chunk and to a module by name', async () => {
      const tx = fakeTx();
      tx.module.findMany.mockResolvedValue([{ id: 'm1', name: 'Billing', code: 'BILLING' }]);
      const counts = await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        create: [
          { kind: 'requirement', title: 'Send invoices', description: 'D', moduleName: 'billing' },
          { kind: 'rule', title: 'VAT', description: 'D', moduleName: null },
        ],
      });
      expect(call(tx.requirement.create)['data']).toMatchObject({
        ...scope,
        title: 'Send invoices',
        moduleId: 'm1',
        sourceChunkId: 'c1',
        createdById: null,
      });
      expect(call(tx.businessRule.create)['data']).toMatchObject({
        title: 'VAT',
        moduleId: null,
        createdById: null,
      });
      expect(counts.created).toBe(2);
    });

    it('adds extra sources without failing on one that already exists', async () => {
      const tx = fakeTx();
      const counts = await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        link: [
          { kind: 'requirement', id: 'r1' },
          { kind: 'module', id: 'm1' },
        ],
      });
      expect(call(tx.itemSource.createMany)).toEqual({
        data: [
          { chunkId: 'c1', organizationId: 'o1', requirementId: 'r1' },
          { chunkId: 'c1', organizationId: 'o1', moduleId: 'm1' },
        ],
        skipDuplicates: true,
      });
      expect(counts.linked).toBe(2);
    });

    it('deletes only unconfirmed pipeline items owned by the chunk, and never a module still in use', async () => {
      const tx = fakeTx();
      await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        remove: [
          { kind: 'requirement', id: 'r1', repointTo: null },
          { kind: 'module', id: 'm1', repointTo: null },
        ],
      });
      const guard = {
        ...scope,
        sourceChunkId: 'c1',
        createdById: null,
        status: { in: ['OPEN', 'ASSUMED'] },
      };
      expect(call(tx.requirement.deleteMany)['where']).toEqual({ id: 'r1', ...guard });
      expect(call(tx.module.deleteMany)['where']).toEqual({
        id: 'm1',
        ...guard,
        requirements: { none: {} },
        businessRules: { none: {} },
      });
    });

    it('moves an item to another chunk that states it instead of deleting it', async () => {
      const tx = fakeTx();
      await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        remove: [{ kind: 'rule', id: 'u1', repointTo: 'c9' }],
      });
      expect(tx.businessRule.deleteMany).not.toHaveBeenCalled();
      expect(call(tx.businessRule.updateMany)).toMatchObject({
        where: { id: 'u1', sourceChunkId: 'c1', createdById: null },
        data: { sourceChunkId: 'c9' },
      });
      expect(call(tx.itemSource.deleteMany)['where']).toMatchObject({
        chunkId: 'c9',
        ruleId: 'u1',
      });
    });

    it('moves stale items the chunk states again back to OPEN, only if they are still stale', async () => {
      const tx = fakeTx();
      await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        revalidate: [
          { kind: 'requirement', id: 'r1' },
          { kind: 'rule', id: 'u1' },
          { kind: 'module', id: 'm1' },
        ],
      });
      for (const model of [tx.requirement, tx.businessRule, tx.module]) {
        expect(call(model.updateMany)).toEqual({
          where: expect.objectContaining({
            organizationId: 'o1',
            projectId: 'p1',
            status: 'NEEDS_REVALIDATION',
          }),
          data: { status: 'OPEN' },
        });
      }
    });

    it('drops links from this chunk to items it no longer states', async () => {
      const tx = fakeTx();
      await applyPlan(tx as never, scope, 'c1', {
        ...emptyPlan,
        unlink: [{ kind: 'requirement', id: 'r1' }],
      });
      expect(call(tx.itemSource.deleteMany)['where']).toEqual({
        chunkId: 'c1',
        organizationId: 'o1',
        requirementId: 'r1',
      });
    });
  });

  it('records the chunk as extracted, and whether it needs a person to look at it', async () => {
    const tx = fakeTx();
    await markExtracted(tx as never, scope, 'c1', true);
    expect(call(tx.chunk.updateMany)).toMatchObject({
      where: { id: 'c1', ...scope },
      data: { needsReview: true, extractedAt: expect.any(Date) },
    });
  });

  describe('finishSourceIfDone', () => {
    const chunkRow = (overrides: Args = {}) => ({
      documentVersionId: 'v1',
      contextNoteId: null,
      documentVersion: { documentId: 'd1', versionNumber: 2 },
      ...overrides,
    });

    it('does nothing while a sibling chunk is still waiting', async () => {
      const tx = fakeTx();
      tx.chunk.findFirst.mockResolvedValue(chunkRow());
      tx.chunk.count.mockResolvedValue(1);
      expect(await finishSourceIfDone(tx as never, scope, 'c1')).toBe(false);
      expect(call(tx.chunk.count)['where']).toMatchObject({
        documentVersionId: 'v1',
        extractedAt: null,
      });
      expect(tx.document.updateMany).not.toHaveBeenCalled();
    });

    it('processes the document when its last chunk is done, unless a newer version exists', async () => {
      const tx = fakeTx();
      tx.chunk.findFirst.mockResolvedValue(chunkRow());
      expect(await finishSourceIfDone(tx as never, scope, 'c1')).toBe(true);
      expect(call(tx.document.updateMany)).toMatchObject({
        where: {
          id: 'd1',
          ...scope,
          status: 'PROCESSING',
          versions: { none: { versionNumber: { gt: 2 } } },
        },
        data: { status: 'PROCESSED' },
      });
      tx.document.updateMany.mockResolvedValue({ count: 0 });
      expect(await finishSourceIfDone(tx as never, scope, 'c1')).toBe(false);
    });

    it('processes a note when its last chunk is done', async () => {
      const tx = fakeTx();
      tx.chunk.findFirst.mockResolvedValue(
        chunkRow({ documentVersionId: null, documentVersion: null, contextNoteId: 'n1' }),
      );
      expect(await finishSourceIfDone(tx as never, scope, 'c1')).toBe(true);
      expect(call(tx.contextNote.updateMany)).toMatchObject({
        where: { id: 'n1', ...scope, status: 'PROCESSING' },
        data: { status: 'PROCESSED' },
      });
    });
  });

  describe('failSourceOfChunk', () => {
    it('fails a document that is still processing, and nothing else', async () => {
      const tx = fakeTx();
      tx.chunk.findFirst.mockResolvedValue({
        documentVersion: { documentId: 'd1' },
        contextNoteId: null,
      });
      await failSourceOfChunk(tx as never, scope, 'c1', 'why');
      expect(call(tx.document.updateMany)).toEqual({
        where: { id: 'd1', ...scope, status: 'PROCESSING' },
        data: { status: 'FAILED', errorMessage: 'why' },
      });
      expect(tx.contextNote.updateMany).not.toHaveBeenCalled();
    });

    it('fails a note that is still processing', async () => {
      const tx = fakeTx();
      tx.chunk.findFirst.mockResolvedValue({ documentVersion: null, contextNoteId: 'n1' });
      await failSourceOfChunk(tx as never, scope, 'c1', 'why');
      expect(call(tx.contextNote.updateMany)).toMatchObject({
        where: { id: 'n1', ...scope, status: 'PROCESSING' },
      });
    });

    it('does nothing for a chunk that is not in this project', async () => {
      const tx = fakeTx();
      await failSourceOfChunk(tx as never, scope, 'c1', 'why');
      expect(tx.document.updateMany).not.toHaveBeenCalled();
      expect(tx.contextNote.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('releaseChunkItems', () => {
    it('deletes unconfirmed items and reports the chunk free when nothing else points at it', async () => {
      const tx = fakeTx();
      tx.requirement.findMany.mockResolvedValue([{ id: 'r1', extraSources: [] }]);
      expect(await releaseChunkItems(tx as never, scope, 'c1')).toBe(true);
      expect(call(tx.requirement.deleteMany)['where']).toMatchObject({
        id: 'r1',
        sourceChunkId: 'c1',
      });
    });

    it('reports the chunk still in use when a confirmed or person-made item points at it', async () => {
      const tx = fakeTx();
      tx.requirement.count.mockResolvedValue(1);
      expect(await releaseChunkItems(tx as never, scope, 'c1')).toBe(false);
      expect(call(tx.requirement.count)['where']).toEqual({ ...scope, sourceChunkId: 'c1' });
    });

    it('moves an item that another chunk also states', async () => {
      const tx = fakeTx();
      tx.businessRule.findMany.mockResolvedValue([{ id: 'u1', extraSources: [{ chunkId: 'c9' }] }]);
      await releaseChunkItems(tx as never, scope, 'c1');
      expect(call(tx.businessRule.updateMany)).toMatchObject({ data: { sourceChunkId: 'c9' } });
    });
  });

  it('sends everything from earlier versions to revalidation, except rejected items', async () => {
    const tx = fakeTx();
    await markOlderVersionItems(tx as never, scope, 'd1', 3);
    for (const model of [tx.module, tx.requirement, tx.businessRule]) {
      expect(call(model.updateMany)).toMatchObject({
        where: {
          ...scope,
          status: { in: ['CONFIRMED', 'ASSUMED', 'OPEN'] },
          sourceChunk: { documentVersion: { documentId: 'd1', versionNumber: { lt: 3 } } },
        },
        data: { status: 'NEEDS_REVALIDATION' },
      });
    }
  });
});
