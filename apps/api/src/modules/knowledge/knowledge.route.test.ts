import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../config/env.js', async () => (await import('../../test/test-env.js')).envModule);
vi.mock('../../lib/logger.js', async () => (await import('../../test/test-env.js')).loggerModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock(
  '../../lib/transaction.js',
  async () => (await import('../../test/fake-db.js')).transactionModule,
);
vi.mock(
  '../auth/auth.repository.js',
  async () => (await import('../../test/fake-db.js')).authRepositoryModule,
);
vi.mock(
  '../access/access.repository.js',
  async () => (await import('../../test/fake-db.js')).accessRepositoryModule,
);
vi.mock(
  '../projects/projects.repository.js',
  async () => (await import('../../test/fake-db.js')).projectsRepositoryModule,
);
vi.mock(
  '../members/members.repository.js',
  async () => (await import('../../test/fake-db.js')).membersRepositoryModule,
);
vi.mock(
  './knowledge.repository.js',
  async () => (await import('../../test/fake-db.js')).knowledgeRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { createApp } from '../../app.js';
import { addKnowledge, db, type FakeChunk, type FakeKnowledgeStatus } from '../../test/fake-db.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

type Actor = keyof Pick<
  World,
  'ownerA' | 'analystA' | 'approverA' | 'viewerA' | 'adminA' | 'outsiderA' | 'adminB' | 'userB'
>;

const READERS: Actor[] = ['ownerA', 'analystA', 'approverA', 'viewerA', 'adminA'];
const STRANGERS: Actor[] = ['outsiderA', 'adminB', 'userB'];

describe('knowledge routes', () => {
  let world: World;
  let docChunk: FakeChunk;
  let noteChunk: FakeChunk;
  let docId: string;
  let noteId: string;
  const sessions = new Map<Actor, Session>();

  const url = (projectId: string, path: string) => `/api/projects/${projectId}/${path}`;

  async function sessionFor(actor: Actor): Promise<Session> {
    const cached = sessions.get(actor);
    if (cached) return cached;
    const session = await login(app, world[actor].email, PASSWORD);
    sessions.set(actor, session);
    return session;
  }

  function seedChunk(opts: {
    projectId: string;
    document?: { id: string; versionId: string } | undefined;
    noteId?: string | undefined;
    headingPath?: string[];
    needsReview?: boolean;
    content?: string;
    index?: number;
  }): FakeChunk {
    const chunk: FakeChunk = {
      id: crypto.randomUUID(),
      chunkIndex: opts.index ?? 0,
      headingPath: opts.headingPath ?? ['1. Scope', '1.1 Billing'],
      content: opts.content ?? 'The system shall invoice monthly.',
      documentVersionId: opts.document?.versionId ?? null,
      contextNoteId: opts.noteId ?? null,
      projectId: opts.projectId,
      organizationId: world.orgA,
      needsReview: opts.needsReview ?? false,
    };
    db.chunks.set(chunk.id, chunk);
    return chunk;
  }

  function seedSources(): void {
    const now = new Date();
    docId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    db.documents.set(docId, {
      id: docId,
      title: 'Billing BRD',
      fileName: 'billing.pdf',
      mimeType: 'application/pdf',
      status: 'PROCESSED',
      errorMessage: null,
      projectId: world.p1.id,
      organizationId: world.orgA,
      createdById: world.analystA.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    db.versions.set(versionId, {
      id: versionId,
      documentId: docId,
      organizationId: world.orgA,
      createdById: world.analystA.id,
      versionNumber: 2,
      fileKey: crypto.randomUUID(),
      contentHash: 'h',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      createdAt: now,
    });
    noteId = crypto.randomUUID();
    db.notes.set(noteId, {
      id: noteId,
      title: 'Kickoff call',
      body: 'x',
      status: 'PROCESSED',
      errorMessage: null,
      projectId: world.p1.id,
      organizationId: world.orgA,
      createdById: world.analystA.id,
      createdAt: now,
      updatedAt: now,
    });
    docChunk = seedChunk({ projectId: world.p1.id, document: { id: docId, versionId } });
    noteChunk = seedChunk({
      projectId: world.p1.id,
      noteId,
      headingPath: [],
      content: 'Customer wants VAT on every invoice.',
    });
  }

  function req(
    chunk: FakeChunk,
    over: Partial<{ title: string; status: FakeKnowledgeStatus; moduleId: string | null }> = {},
  ) {
    return addKnowledge('requirements', {
      organizationId: world.orgA,
      projectId: world.p1.id,
      sourceChunkId: chunk.id,
      title: 'Invoice monthly',
      description: 'Send an invoice each month',
      ...over,
    });
  }

  beforeEach(async () => {
    world = await buildWorld();
    sessions.clear();
    seedSources();
  });

  describe('permissions and tenancy', () => {
    const paths = (w: World, chunkId: string) => [
      url(w.p1.id, 'requirements'),
      url(w.p1.id, 'rules'),
      url(w.p1.id, 'modules'),
      url(w.p1.id, 'knowledge-summary'),
      url(w.p1.id, `chunks/${chunkId}`),
    ];

    it('requires authentication on every endpoint', async () => {
      for (const path of paths(world, docChunk.id)) {
        expect((await request(app).get(path)).status).toBe(401);
      }
    });

    it.each(READERS)('lets %s read every endpoint', async (actor) => {
      const session = await sessionFor(actor);
      for (const path of paths(world, docChunk.id)) {
        expect((await as(app, session, 'get', path)).status).toBe(200);
      }
    });

    it.each(STRANGERS)('returns 404 to %s on every endpoint', async (actor) => {
      const session = await sessionFor(actor);
      for (const path of paths(world, docChunk.id)) {
        expect((await as(app, session, 'get', path)).status).toBe(404);
      }
    });

    it('does not show items of another project of the same organization', async () => {
      const otherChunk = seedChunk({ projectId: world.p2.id });
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p2.id,
        sourceChunkId: otherChunk.id,
        title: 'Only in P2',
      });
      req(docChunk);

      const owner = await sessionFor('ownerA');
      const res = await as(app, owner, 'get', url(world.p1.id, 'requirements'));
      expect(res.body.items.map((i: { title: string }) => i.title)).toEqual(['Invoice monthly']);
    });

    it('does not serve a chunk through a different project', async () => {
      const owner = await sessionFor('ownerA');
      const res = await as(app, owner, 'get', url(world.p2.id, `chunks/${docChunk.id}`));
      expect(res.status).toBe(404);
    });

    it('rejects malformed ids and filters with 400', async () => {
      const owner = await sessionFor('ownerA');
      const bad = [
        url('not-a-uuid', 'requirements'),
        url(world.p1.id, 'chunks/not-a-uuid'),
        `${url(world.p1.id, 'requirements')}?status=BOGUS`,
        `${url(world.p1.id, 'rules')}?sourceId=nope`,
        `${url(world.p1.id, 'modules')}?pageSize=1000`,
        `${url(world.p1.id, 'requirements')}?search=${'x'.repeat(101)}`,
      ];
      for (const path of bad) {
        expect((await as(app, owner, 'get', path)).status).toBe(400);
      }
    });
  });

  describe('GET requirements', () => {
    it('returns the item with its source, author and module', async () => {
      const aiModule = addKnowledge('modules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        name: 'Billing',
        code: 'BIL',
      });
      req(docChunk, { moduleId: aiModule.id });
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: noteChunk.id,
        title: 'Add VAT',
        createdById: world.analystA.id,
      });

      const res = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        url(world.p1.id, 'requirements'),
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
      const byTitle = Object.fromEntries(
        res.body.items.map((i: { title: string }) => [i.title, i]),
      );
      expect(byTitle['Invoice monthly']).toMatchObject({
        status: 'OPEN',
        createdBy: 'AI',
        module: { id: aiModule.id, name: 'Billing' },
        source: {
          chunkId: docChunk.id,
          type: 'document',
          sourceId: docId,
          sourceTitle: 'Billing BRD',
          versionNumber: 2,
          headingPath: ['1. Scope', '1.1 Billing'],
          needsReview: false,
        },
      });
      expect(byTitle['Add VAT']).toMatchObject({
        createdBy: { id: world.analystA.id },
        source: {
          type: 'note',
          sourceId: noteId,
          sourceTitle: 'Kickoff call',
          versionNumber: null,
        },
      });
    });

    it('filters by status, module, source and search, and combines them', async () => {
      const mod = addKnowledge('modules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        name: 'Billing',
      });
      req(docChunk, { title: 'Invoice monthly', status: 'CONFIRMED', moduleId: mod.id });
      req(docChunk, { title: 'Invoice yearly', status: 'NEEDS_REVALIDATION' });
      req(noteChunk, { title: 'Add VAT', status: 'CONFIRMED' });
      const owner = await sessionFor('ownerA');
      const titles = async (query: string) =>
        (
          (await as(app, owner, 'get', `${url(world.p1.id, 'requirements')}?${query}`)).body
            .items as { title: string }[]
        )
          .map((i) => i.title)
          .sort();

      expect(await titles('status=CONFIRMED')).toEqual(['Add VAT', 'Invoice monthly']);
      expect(await titles(`moduleId=${mod.id}`)).toEqual(['Invoice monthly']);
      expect(await titles(`sourceId=${noteId}`)).toEqual(['Add VAT']);
      expect(await titles(`sourceId=${docId}`)).toEqual(['Invoice monthly', 'Invoice yearly']);
      expect(await titles('search=YEARLY')).toEqual(['Invoice yearly']);
      expect(await titles(`sourceId=${docId}&status=CONFIRMED&search=invoice`)).toEqual([
        'Invoice monthly',
      ]);
      expect(await titles('status=REJECTED')).toEqual([]);
    });

    it('paginates and reports the total', async () => {
      for (let i = 0; i < 5; i += 1) req(docChunk, { title: `Req ${String(i)}` });
      const owner = await sessionFor('ownerA');
      const res = await as(
        app,
        owner,
        'get',
        `${url(world.p1.id, 'requirements')}?page=2&pageSize=2`,
      );
      expect(res.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(res.body.items).toHaveLength(2);
    });

    it('flags items whose source chunk needs review', async () => {
      const flagged = seedChunk({ projectId: world.p1.id, noteId, needsReview: true, index: 1 });
      req(flagged);
      const res = await as(
        app,
        await sessionFor('ownerA'),
        'get',
        url(world.p1.id, 'requirements'),
      );
      expect(res.body.items[0].source.needsReview).toBe(true);
    });

    it('returns an empty page, not an error, when there is nothing', async () => {
      const res = await as(
        app,
        await sessionFor('ownerA'),
        'get',
        url(world.p1.id, 'requirements'),
      );
      expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    });
  });

  describe('items merged from several sources', () => {
    it('shows the first source and the other chunks, and is found through either source', async () => {
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        extraChunkIds: [noteChunk.id],
        title: 'Invoice monthly',
      });
      const viewer = await sessionFor('viewerA');

      const all = await as(app, viewer, 'get', url(world.p1.id, 'requirements'));
      expect(all.body.items).toHaveLength(1);
      expect(all.body.items[0].source).toMatchObject({ type: 'document', sourceId: docId });
      expect(all.body.items[0].otherSources).toEqual([
        expect.objectContaining({ type: 'note', sourceId: noteId, chunkId: noteChunk.id }),
      ]);

      for (const sourceId of [docId, noteId]) {
        const filtered = await as(
          app,
          viewer,
          'get',
          `${url(world.p1.id, 'requirements')}?sourceId=${sourceId}`,
        );
        expect(filtered.body.items).toHaveLength(1);
      }
      const other = await as(
        app,
        viewer,
        'get',
        `${url(world.p1.id, 'requirements')}?sourceId=${crypto.randomUUID()}`,
      );
      expect(other.body.items).toEqual([]);
    });

    it('gives an item found in one place an empty list of other sources', async () => {
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
      });
      const res = await as(app, await sessionFor('viewerA'), 'get', url(world.p1.id, 'requirements'));
      expect(res.body.items[0].otherSources).toEqual([]);
    });
  });

  describe('GET rules and modules', () => {
    it('lists rules with their module and source', async () => {
      const mod = addKnowledge('modules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        name: 'Billing',
      });
      addKnowledge('rules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        title: 'VAT is 20%',
        status: 'ASSUMED',
        moduleId: mod.id,
      });
      const res = await as(app, await sessionFor('viewerA'), 'get', url(world.p1.id, 'rules'));
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        title: 'VAT is 20%',
        status: 'ASSUMED',
        module: { name: 'Billing' },
        source: { sourceId: docId },
      });
      const filtered = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        `${url(world.p1.id, 'rules')}?moduleId=${crypto.randomUUID()}`,
      );
      expect(filtered.body.items).toEqual([]);
    });

    it('lists modules alphabetically with their requirement count', async () => {
      const billing = addKnowledge('modules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        name: 'Billing',
        code: 'BIL',
      });
      addKnowledge('modules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: noteChunk.id,
        name: 'Accounts',
        code: 'ACC',
      });
      req(docChunk, { moduleId: billing.id });
      req(docChunk, { moduleId: billing.id });

      const res = await as(app, await sessionFor('viewerA'), 'get', url(world.p1.id, 'modules'));

      expect(res.body.items.map((m: { name: string }) => m.name)).toEqual(['Accounts', 'Billing']);
      expect(res.body.items[1]).toMatchObject({ code: 'BIL', requirementCount: 2 });
      const search = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        `${url(world.p1.id, 'modules')}?search=acc`,
      );
      expect(search.body.items.map((m: { code: string }) => m.code)).toEqual(['ACC']);
    });
  });

  describe('GET knowledge-summary', () => {
    it('counts every status per kind, with zeros, and chunks needing review', async () => {
      req(docChunk, { status: 'CONFIRMED' });
      req(docChunk, { status: 'CONFIRMED' });
      req(docChunk, { status: 'NEEDS_REVALIDATION' });
      addKnowledge('rules', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceChunkId: docChunk.id,
        status: 'OPEN',
      });
      seedChunk({ projectId: world.p1.id, noteId, needsReview: true, index: 1 });

      const res = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        url(world.p1.id, 'knowledge-summary'),
      );

      expect(res.body.summary.counts.requirements).toEqual({
        CONFIRMED: 2,
        ASSUMED: 0,
        OPEN: 0,
        REJECTED: 0,
        NEEDS_REVALIDATION: 1,
      });
      expect(res.body.summary.counts.rules.OPEN).toBe(1);
      expect(res.body.summary.counts.modules.OPEN).toBe(0);
      expect(res.body.summary.chunksNeedingReview).toBe(1);
    });

    it('ignores other projects', async () => {
      const other = seedChunk({ projectId: world.p2.id });
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p2.id,
        sourceChunkId: other.id,
        status: 'CONFIRMED',
      });
      const res = await as(
        app,
        await sessionFor('ownerA'),
        'get',
        url(world.p1.id, 'knowledge-summary'),
      );
      expect(res.body.summary.counts.requirements.CONFIRMED).toBe(0);
    });
  });

  describe('GET chunks/:chunkId', () => {
    it('returns the exact text, heading path and document source', async () => {
      const res = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        url(world.p1.id, `chunks/${docChunk.id}`),
      );
      expect(res.body.chunk).toEqual({
        id: docChunk.id,
        chunkIndex: 0,
        headingPath: ['1. Scope', '1.1 Billing'],
        content: 'The system shall invoice monthly.',
        needsReview: false,
        source: { type: 'document', sourceId: docId, sourceTitle: 'Billing BRD', versionNumber: 2 },
      });
    });

    it('returns a note chunk with no version', async () => {
      const res = await as(
        app,
        await sessionFor('viewerA'),
        'get',
        url(world.p1.id, `chunks/${noteChunk.id}`),
      );
      expect(res.body.chunk.source).toEqual({
        type: 'note',
        sourceId: noteId,
        sourceTitle: 'Kickoff call',
        versionNumber: null,
      });
      expect(res.body.chunk.headingPath).toEqual([]);
    });

    it('returns 404 for an unknown chunk', async () => {
      const res = await as(
        app,
        await sessionFor('ownerA'),
        'get',
        url(world.p1.id, `chunks/${crypto.randomUUID()}`),
      );
      expect(res.status).toBe(404);
    });
  });
});
