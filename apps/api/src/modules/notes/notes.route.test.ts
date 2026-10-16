import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const queue = vi.hoisted(() => ({ enqueueJob: vi.fn() }));

vi.mock('../../config/env.js', async () => (await import('../../test/test-env.js')).envModule);
vi.mock('../../lib/logger.js', async () => (await import('../../test/test-env.js')).loggerModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/queue.service.js', () => queue);
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
  './notes.repository.js',
  async () => (await import('../../test/fake-db.js')).notesRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { MAX_NOTE_CHARS } from '@brd/shared';
import { createApp } from '../../app.js';
import { db } from '../../test/fake-db.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

describe('notes routes', () => {
  let world: World;
  let analyst: Session;

  const base = (projectId: string) => `/api/projects/${projectId}/notes`;
  const note = { title: 'Kickoff', body: '# Goals\nCut invoice errors.' };

  beforeEach(async () => {
    world = await buildWorld();
    analyst = await login(app, world.analystA.email, PASSWORD);
    queue.enqueueJob.mockReset().mockResolvedValue('job-1');
  });

  it('requires authentication', async () => {
    expect((await request(app).get(base(world.p1.id))).status).toBe(401);
  });

  it('lets an analyst create a note, queues it and audits it', async () => {
    const res = await as(app, analyst, 'post', base(world.p1.id)).send(note);
    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({
      title: 'Kickoff',
      status: 'UPLOADED',
      chunkCount: 0,
      createdBy: { id: world.analystA.id },
    });
    expect(queue.enqueueJob).toHaveBeenCalledWith('process-source', {
      organizationId: world.orgA,
      projectId: world.p1.id,
      sourceType: 'note',
      sourceId: res.body.note.id,
    });
    expect(db.audit.some((a) => a.action === 'CREATE' && a.entity === 'ContextNote')).toBe(true);
  });

  it('lets every role read notes but only ADD_SOURCE roles write', async () => {
    await as(app, analyst, 'post', base(world.p1.id)).send(note);
    for (const user of [world.viewerA, world.approverA]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(200);
      expect((await as(app, session, 'post', base(world.p1.id)).send(note)).status).toBe(403);
    }
  });

  it('returns 404 to non-members and other organizations', async () => {
    for (const user of [world.outsiderA, world.adminB]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(404);
      expect((await as(app, session, 'post', base(world.p1.id)).send(note)).status).toBe(404);
    }
    expect(db.notes.size).toBe(0);
  });

  it('validates title and body, including the character limit', async () => {
    const send = (body: object) => as(app, analyst, 'post', base(world.p1.id)).send(body);
    expect((await send({ title: '', body: 'x' })).status).toBe(400);
    expect((await send({ title: 't', body: '   ' })).status).toBe(400);
    expect((await send({ title: 't', body: 'x'.repeat(MAX_NOTE_CHARS + 1) })).status).toBe(400);
    expect((await send({ title: 't', body: 'x'.repeat(MAX_NOTE_CHARS) })).status).toBe(201);
  });

  it('edits a note, resets it to waiting and queues it again', async () => {
    const created = await as(app, analyst, 'post', base(world.p1.id)).send(note);
    const id = created.body.note.id as string;
    const stored = db.notes.get(id);
    if (stored) stored.status = 'PROCESSED';
    queue.enqueueJob.mockClear();

    const res = await as(app, analyst, 'patch', `${base(world.p1.id)}/${id}`).send({
      body: 'New text',
    });
    expect(res.status).toBe(200);
    expect(res.body.note).toMatchObject({ body: 'New text', title: 'Kickoff', status: 'UPLOADED' });
    expect(queue.enqueueJob).toHaveBeenCalledTimes(1);
  });

  it('rejects empty edits and edits to notes of another project', async () => {
    const created = await as(app, analyst, 'post', base(world.p1.id)).send(note);
    const id = created.body.note.id as string;
    expect((await as(app, analyst, 'patch', `${base(world.p1.id)}/${id}`).send({})).status).toBe(
      400,
    );

    const owner = await login(app, world.ownerA.email, PASSWORD);
    expect(
      (await as(app, owner, 'patch', `${base(world.p2.id)}/${id}`).send({ title: 'x' })).status,
    ).toBe(404);
  });

  it('keeps the note but marks it FAILED when queueing fails', async () => {
    queue.enqueueJob.mockRejectedValue(new Error('boss down'));
    const res = await as(app, analyst, 'post', base(world.p1.id)).send(note);
    expect(res.status).toBe(201);
    expect(res.body.note.status).toBe('FAILED');
    expect(res.body.note.failureReason).toMatch(/Could not queue/);
  });

  it('lists notes with their chunk counts', async () => {
    const created = await as(app, analyst, 'post', base(world.p1.id)).send(note);
    const id = created.body.note.id as string;
    db.chunks.set('c1', {
      id: 'c1',
      chunkIndex: 0,
      headingPath: [],
      content: 'x',
      documentVersionId: null,
      contextNoteId: id,
      projectId: world.p1.id,
      organizationId: world.orgA,
    });
    const res = await as(app, analyst, 'get', base(world.p1.id));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].chunkCount).toBe(1);
  });
});
