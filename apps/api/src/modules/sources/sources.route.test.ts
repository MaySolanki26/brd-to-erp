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
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
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
const usage = vi.hoisted(() => ({ tokensUsedSince: vi.fn().mockResolvedValue(0) }));
vi.mock('../../services/llm/llm-usage.repository.js', () => usage);
vi.mock(
  './sources.repository.js',
  async () => (await import('../../test/fake-db.js')).sourcesRepositoryModule,
);

import { createApp } from '../../app.js';
import { db, type SourceStatusValue } from '../../test/fake-db.js';
import { as, login } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

function seed(world: World, projectId: string, status: SourceStatusValue, kind: 'doc' | 'note') {
  const now = new Date();
  const base = {
    id: `${kind}-${String(db.documents.size + db.notes.size)}`,
    status,
    errorMessage: null,
    projectId,
    organizationId: world.orgA,
    createdById: world.analystA.id,
    createdAt: now,
    updatedAt: now,
  };
  if (kind === 'doc') {
    db.documents.set(base.id, {
      ...base,
      title: base.id,
      fileName: `${base.id}.pdf`,
      mimeType: 'application/pdf',
      deletedAt: null,
    });
  } else {
    db.notes.set(base.id, { ...base, title: base.id, body: 'x' });
  }
}

describe('GET /api/projects/:id/processing-status', () => {
  let world: World;
  const url = (id: string) => `/api/projects/${id}/processing-status`;

  beforeEach(async () => {
    world = await buildWorld();
  });

  it('requires authentication', async () => {
    expect((await request(app).get(url(world.p1.id))).status).toBe(401);
  });

  it('counts documents and notes together and lists only active sources', async () => {
    seed(world, world.p1.id, 'PROCESSED', 'doc');
    seed(world, world.p1.id, 'PROCESSING', 'doc');
    seed(world, world.p1.id, 'UPLOADED', 'note');
    seed(world, world.p1.id, 'FAILED', 'note');
    seed(world, world.p2.id, 'UPLOADED', 'doc');

    const session = await login(app, world.viewerA.email, PASSWORD);
    const res = await as(app, session, 'get', url(world.p1.id));
    expect(res.status).toBe(200);
    expect(res.body.status.counts).toEqual({ UPLOADED: 1, PROCESSING: 1, PROCESSED: 1, FAILED: 1 });
    expect(res.body.status.active).toBe(true);
    expect(res.body.status.sources).toHaveLength(2);
    expect(res.body.status.sources.map((s: { type: string }) => s.type).sort()).toEqual([
      'document',
      'note',
    ]);
  });

  it('reports when the latest source finished processing, or null if none has', async () => {
    const session = await login(app, world.viewerA.email, PASSWORD);
    seed(world, world.p1.id, 'UPLOADED', 'doc');
    const before = await as(app, session, 'get', url(world.p1.id));
    expect(before.body.status.lastProcessedAt).toBeNull();

    seed(world, world.p1.id, 'PROCESSED', 'doc');
    seed(world, world.p1.id, 'PROCESSED', 'note');
    for (const note of db.notes.values()) note.updatedAt = new Date('2026-05-01T10:00:00.000Z');
    for (const doc of db.documents.values()) {
      if (doc.status === 'PROCESSED') doc.updatedAt = new Date('2026-04-01T10:00:00.000Z');
    }
    const after = await as(app, session, 'get', url(world.p1.id));
    expect(after.body.status.lastProcessedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it('says when the project has used up its monthly LLM budget, and not before', async () => {
    const session = await login(app, world.viewerA.email, PASSWORD);
    usage.tokensUsedSince.mockResolvedValueOnce(1_999_999);
    expect((await as(app, session, 'get', url(world.p1.id))).body.status.llmPaused).toBe(false);

    usage.tokensUsedSince.mockResolvedValueOnce(2_000_000);
    expect((await as(app, session, 'get', url(world.p1.id))).body.status.llmPaused).toBe(true);
    expect(usage.tokensUsedSince).toHaveBeenLastCalledWith(
      world.orgA,
      world.p1.id,
      expect.any(Date),
    );
  });

  it('reports inactive when everything has finished', async () => {
    seed(world, world.p1.id, 'PROCESSED', 'doc');
    seed(world, world.p1.id, 'FAILED', 'note');
    const session = await login(app, world.viewerA.email, PASSWORD);
    const res = await as(app, session, 'get', url(world.p1.id));
    expect(res.body.status.active).toBe(false);
    expect(res.body.status.sources).toEqual([]);
  });

  it('returns 404 to non-members and other organizations', async () => {
    for (const user of [world.outsiderA, world.adminB]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', url(world.p1.id))).status).toBe(404);
    }
  });
});
