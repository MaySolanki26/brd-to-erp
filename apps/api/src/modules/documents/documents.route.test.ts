import { readFileSync } from 'node:fs';
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
  '../../services/storage/index.js',
  async () => (await import('../../test/fake-db.js')).storageModule,
);
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
  './documents.repository.js',
  async () => (await import('../../test/fake-db.js')).documentsRepositoryModule,
);
vi.mock(
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);

import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { createApp } from '../../app.js';
import { db, storageFiles, type FakeUser } from '../../test/fake-db.js';
import { buildPdf, buildXlsx } from '../../test/build-files.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const docx = readFileSync(new URL('../../test/fixtures/requirements.docx', import.meta.url));
const pdf = (text = 'Hello BRD') => buildPdf([text]);

describe('documents routes', () => {
  let world: World;
  let analyst: Session;

  const base = (projectId: string) => `/api/projects/${projectId}/documents`;

  function fileKeyOf(ticket: string): string {
    const payload = JSON.parse(
      Buffer.from(ticket.split('.')[0] ?? '', 'base64url').toString('utf8'),
    ) as { k: string };
    return payload.k;
  }

  interface Staged {
    name?: string;
    mime?: string;
    bytes?: Buffer;
    declaredSize?: number;
    projectId?: string;
    documentId?: string;
    store?: boolean;
  }

  /** Requests an upload URL and, like the browser would, puts the bytes into storage. */
  async function stage(session: Session, opts: Staged = {}): Promise<string> {
    const bytes = opts.bytes ?? pdf();
    const res = await as(
      app,
      session,
      'post',
      `${base(opts.projectId ?? world.p1.id)}/upload-url`,
    ).send({
      fileName: opts.name ?? 'brd.pdf',
      mimeType: opts.mime ?? PDF,
      sizeBytes: opts.declaredSize ?? bytes.length,
      ...(opts.documentId && { documentId: opts.documentId }),
    });
    expect(res.status).toBe(201);
    const ticket = res.body.upload.ticket as string;
    if (opts.store !== false) storageFiles.set(fileKeyOf(ticket), bytes);
    return ticket;
  }

  const confirm = (session: Session, ticket: string, projectId = world.p1.id) =>
    as(app, session, 'post', `${base(projectId)}/confirm`).send({ ticket });

  beforeEach(async () => {
    world = await buildWorld();
    analyst = await login(app, world.analystA.email, PASSWORD);
    queue.enqueueJob.mockReset().mockResolvedValue('job-1');
  });

  describe('permissions and tenancy', () => {
    const asUser = (user: FakeUser) => login(app, user.email, PASSWORD);

    it('requires authentication', async () => {
      expect((await request(app).get(base(world.p1.id))).status).toBe(401);
    });

    it('lets every project role read the list', async () => {
      for (const user of [world.viewerA, world.approverA, world.analystA, world.ownerA]) {
        const res = await as(app, await asUser(user), 'get', base(world.p1.id));
        expect(res.status).toBe(200);
      }
    });

    it('forbids uploading for viewers and approvers (no ADD_SOURCE)', async () => {
      for (const user of [world.viewerA, world.approverA]) {
        const res = await as(
          app,
          await asUser(user),
          'post',
          `${base(world.p1.id)}/upload-url`,
        ).send({
          fileName: 'a.pdf',
          mimeType: PDF,
          sizeBytes: 10,
        });
        expect(res.status).toBe(403);
      }
    });

    it('forbids reprocessing for roles without REPROCESS', async () => {
      const id = (await seedDocument('PROCESSED')).id;
      for (const user of [world.viewerA, world.approverA]) {
        const res = await as(
          app,
          await asUser(user),
          'post',
          `${base(world.p1.id)}/${id}/reprocess`,
        );
        expect(res.status).toBe(403);
      }
    });

    it('returns 404 to non-members and to admins of another organization', async () => {
      const id = (await seedDocument('PROCESSED')).id;
      for (const user of [world.outsiderA, world.adminB, world.userB]) {
        const session = await asUser(user);
        expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(404);
        expect((await as(app, session, 'get', `${base(world.p1.id)}/${id}`)).status).toBe(404);
        const up = await as(app, session, 'post', `${base(world.p1.id)}/upload-url`).send({
          fileName: 'a.pdf',
          mimeType: PDF,
          sizeBytes: 10,
        });
        expect(up.status).toBe(404);
      }
    });

    it('lets an organization admin work in any project of their organization', async () => {
      const session = await asUser(world.adminA);
      expect((await as(app, session, 'get', base(world.p2.id))).status).toBe(200);
      const ticket = await stage(session, { projectId: world.p2.id });
      expect((await confirm(session, ticket, world.p2.id)).status).toBe(201);
    });

    it('does not reveal a document through another project of the same organization', async () => {
      const id = (await seedDocument('PROCESSED')).id;
      const owner = await asUser(world.ownerA);
      expect((await as(app, owner, 'get', `${base(world.p2.id)}/${id}`)).status).toBe(404);
      expect((await as(app, owner, 'post', `${base(world.p2.id)}/${id}/reprocess`)).status).toBe(
        404,
      );
    });

    it('rejects malformed ids with 400', async () => {
      expect((await as(app, analyst, 'get', base('not-a-uuid'))).status).toBe(400);
      expect((await as(app, analyst, 'get', `${base(world.p1.id)}/not-a-uuid`)).status).toBe(400);
    });
  });

  describe('POST /upload-url validation', () => {
    const post = (body: object) =>
      as(app, analyst, 'post', `${base(world.p1.id)}/upload-url`).send(body);

    it('rejects unsupported file types', async () => {
      const res = await post({ fileName: 'notes.txt', mimeType: 'text/plain', sizeBytes: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/PDF, DOCX or XLSX/);
    });

    it('rejects a MIME type that disagrees with the extension', async () => {
      expect((await post({ fileName: 'a.pdf', mimeType: DOCX, sizeBytes: 10 })).status).toBe(400);
    });

    it('rejects empty and oversized files', async () => {
      expect((await post({ fileName: 'a.pdf', mimeType: PDF, sizeBytes: 0 })).status).toBe(400);
      const big = await post({ fileName: 'a.pdf', mimeType: PDF, sizeBytes: MAX_UPLOAD_BYTES + 1 });
      expect(big.status).toBe(400);
    });

    it('rejects a new-version request for a document that does not exist', async () => {
      const res = await post({
        fileName: 'a.pdf',
        mimeType: PDF,
        sizeBytes: 10,
        documentId: '11111111-1111-4111-8111-111111111111',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /confirm', () => {
    it('stores a PDF, queues processing and audits it', async () => {
      const res = await confirm(analyst, await stage(analyst));
      expect(res.status).toBe(201);
      expect(res.body.duplicateOf).toBeNull();
      expect(res.body.document).toMatchObject({
        fileName: 'brd.pdf',
        status: 'UPLOADED',
        versionCount: 1,
        chunkCount: 0,
        latestVersion: { versionNumber: 1, mimeType: PDF },
      });
      expect(queue.enqueueJob).toHaveBeenCalledWith('process-source', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        sourceType: 'document',
        sourceId: res.body.document.id,
        versionId: res.body.document.latestVersion.id,
      });
      expect(db.audit.some((a) => a.action === 'CREATE' && a.entity === 'Document')).toBe(true);
    });

    it('accepts real DOCX and XLSX files', async () => {
      const sheet = await buildXlsx({ Rules: [['id', 'rule']] });
      const word = await confirm(
        analyst,
        await stage(analyst, { name: 'a.docx', mime: DOCX, bytes: docx }),
      );
      const excel = await confirm(
        analyst,
        await stage(analyst, { name: 'a.xlsx', mime: XLSX, bytes: sheet }),
      );
      expect(word.status).toBe(201);
      expect(excel.status).toBe(201);
    });

    it('warns about identical content but still stores the file', async () => {
      const first = await confirm(analyst, await stage(analyst, { name: 'one.pdf' }));
      const second = await confirm(analyst, await stage(analyst, { name: 'two.pdf' }));
      expect(second.status).toBe(201);
      expect(second.body.duplicateOf).toEqual({
        documentId: first.body.document.id,
        title: 'one.pdf',
      });
      expect(db.documents.size).toBe(2);
    });

    it('does not treat the same bytes in another project as a duplicate', async () => {
      const owner = await login(app, world.ownerA.email, PASSWORD);
      await confirm(owner, await stage(owner, { projectId: world.p2.id }), world.p2.id);
      const second = await confirm(analyst, await stage(analyst));
      expect(second.body.duplicateOf).toBeNull();
    });

    it('rejects a spoofed file, deletes it and creates nothing', async () => {
      const evil = Buffer.from('MZ\x90\x00 this is an executable, not a pdf');
      const ticket = await stage(analyst, { bytes: evil });
      const res = await confirm(analyst, ticket);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/does not match its type/);
      expect(storageFiles.has(fileKeyOf(ticket))).toBe(false);
      expect(db.documents.size).toBe(0);
      expect(queue.enqueueJob).not.toHaveBeenCalled();
    });

    it('rejects a zip that is neither a DOCX nor an XLSX', async () => {
      const zipOnly = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
      const res = await confirm(
        analyst,
        await stage(analyst, { name: 'a.docx', mime: DOCX, bytes: zipOnly }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects a DOCX presented as an XLSX', async () => {
      const res = await confirm(
        analyst,
        await stage(analyst, { name: 'a.xlsx', mime: XLSX, bytes: docx }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects a file whose size differs from what was declared', async () => {
      const bytes = pdf();
      const ticket = await stage(analyst, { bytes, declaredSize: bytes.length - 1 });
      const res = await confirm(analyst, ticket);
      expect(res.status).toBe(400);
      expect(storageFiles.has(fileKeyOf(ticket))).toBe(false);
    });

    it('rejects confirming a file that was never uploaded', async () => {
      const res = await confirm(analyst, await stage(analyst, { store: false }));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/not uploaded/);
    });

    it('rejects a replayed ticket without deleting the stored file', async () => {
      const ticket = await stage(analyst);
      expect((await confirm(analyst, ticket)).status).toBe(201);
      const replay = await confirm(analyst, ticket);
      expect(replay.status).toBe(409);
      expect(storageFiles.has(fileKeyOf(ticket))).toBe(true);
      expect(db.documents.size).toBe(1);
    });

    it('rejects tampered and malformed tickets', async () => {
      const ticket = await stage(analyst);
      const [payload = '', signature = ''] = ticket.split('.');
      expect((await confirm(analyst, `${payload}.${signature.slice(0, -2)}xx`)).status).toBe(400);
      expect((await confirm(analyst, 'garbage')).status).toBe(400);
      expect(db.documents.size).toBe(0);
    });

    it("rejects someone else's ticket and a ticket used on another project", async () => {
      const owner = await login(app, world.ownerA.email, PASSWORD);
      const ticket = await stage(analyst);
      expect((await confirm(owner, ticket)).status).toBe(400);
      expect((await confirm(analyst, ticket, world.p2.id)).status).toBe(404);
      expect(db.documents.size).toBe(0);
    });

    it('keeps the document but marks it FAILED when queueing fails', async () => {
      queue.enqueueJob.mockRejectedValue(new Error('boss down'));
      const res = await confirm(analyst, await stage(analyst));
      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('FAILED');
      expect(res.body.document.failureReason).toMatch(/Could not queue/);
    });

    it('adds a new version to an existing document and queues that version', async () => {
      const first = await confirm(analyst, await stage(analyst, { name: 'brd.pdf' }));
      const documentId = first.body.document.id as string;

      const second = await confirm(
        analyst,
        await stage(analyst, { name: 'brd-v2.pdf', bytes: pdf('Version two'), documentId }),
      );
      expect(second.status).toBe(201);
      expect(second.body.document).toMatchObject({
        id: documentId,
        fileName: 'brd-v2.pdf',
        status: 'UPLOADED',
        versionCount: 2,
        latestVersion: { versionNumber: 2 },
      });
      expect(db.documents.size).toBe(1);
      expect(queue.enqueueJob).toHaveBeenLastCalledWith(
        'process-source',
        expect.objectContaining({
          sourceId: documentId,
          versionId: second.body.document.latestVersion.id,
        }),
      );
    });
  });

  describe('reading documents', () => {
    it('lists documents with their latest version and chunk count', async () => {
      const seeded = await seedDocument('PROCESSED', 3);
      const res = await as(app, analyst, 'get', base(world.p1.id));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({
        id: seeded.id,
        chunkCount: 3,
        status: 'PROCESSED',
      });
    });

    it('returns versions and paginated chunks for one document', async () => {
      const seeded = await seedDocument('PROCESSED', 5);
      const res = await as(
        app,
        analyst,
        'get',
        `${base(world.p1.id)}/${seeded.id}?pageSize=2&page=2`,
      );
      expect(res.status).toBe(200);
      expect(res.body.document.versions).toHaveLength(1);
      expect(res.body.document.chunksVersionId).toBe(seeded.versionId);
      expect(res.body.document.chunks).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(
        res.body.document.chunks.items.map((c: { chunkIndex: number }) => c.chunkIndex),
      ).toEqual([2, 3]);
    });

    it('returns 404 for an unknown version', async () => {
      const seeded = await seedDocument('PROCESSED', 1);
      const res = await as(
        app,
        analyst,
        'get',
        `${base(world.p1.id)}/${seeded.id}?versionId=11111111-1111-4111-8111-111111111111`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('reprocess', () => {
    it('re-queues a failed document', async () => {
      const seeded = await seedDocument('FAILED');
      const res = await as(app, analyst, 'post', `${base(world.p1.id)}/${seeded.id}/reprocess`);
      expect(res.status).toBe(200);
      expect(res.body.document.status).toBe('UPLOADED');
      expect(queue.enqueueJob).toHaveBeenCalledWith(
        'process-source',
        expect.objectContaining({ sourceId: seeded.id, versionId: seeded.versionId }),
      );
    });

    it('refuses to reprocess a document that is still waiting or running', async () => {
      for (const status of ['UPLOADED', 'PROCESSING'] as const) {
        const seeded = await seedDocument(status);
        const res = await as(app, analyst, 'post', `${base(world.p1.id)}/${seeded.id}/reprocess`);
        expect(res.status).toBe(409);
      }
      expect(queue.enqueueJob).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('streams the stored file to any project reader and audits the export', async () => {
      const bytes = pdf('Download me');
      const ticket = await stage(analyst, { bytes });
      const created = await confirm(analyst, ticket);
      const { id, latestVersion } = created.body.document as {
        id: string;
        latestVersion: { id: string };
      };

      const viewer = await login(app, world.viewerA.email, PASSWORD);
      const res = await as(
        app,
        viewer,
        'get',
        `${base(world.p1.id)}/${id}/versions/${latestVersion.id}/download`,
      )
        .buffer(true)
        .parse((r, cb) => {
          const parts: Buffer[] = [];
          r.on('data', (d: Buffer) => parts.push(d));
          r.on('end', () => cb(null, Buffer.concat(parts)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(PDF);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename\*=UTF-8''brd\.pdf$/,
      );
      expect(Buffer.from(res.body as Buffer).equals(bytes)).toBe(true);
      expect(db.audit.some((a) => a.action === 'EXPORT' && a.entity === 'DocumentVersion')).toBe(
        true,
      );
    });

    it('returns 404 for non-members and for a version of another document', async () => {
      const a = await seedDocument('PROCESSED');
      const b = await seedDocument('PROCESSED');
      const outsider = await login(app, world.outsiderA.email, PASSWORD);
      const url = `${base(world.p1.id)}/${a.id}/versions/${a.versionId}/download`;
      expect((await as(app, outsider, 'get', url)).status).toBe(404);
      const mixed = `${base(world.p1.id)}/${a.id}/versions/${b.versionId}/download`;
      expect((await as(app, analyst, 'get', mixed)).status).toBe(404);
    });

    it('no longer serves files from the old public storage route', async () => {
      const res = await request(app).get('/storage/download/11111111-1111-4111-8111-111111111111');
      expect(res.status).toBe(404);
    });
  });

  /** Inserts a document with one version directly, bypassing the upload flow. */
  async function seedDocument(
    status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED',
    chunks = 0,
  ) {
    const { documentsRepositoryModule } = await import('../../test/fake-db.js');
    const created = await documentsRepositoryModule.createDocument({
      title: `seed-${String(db.documents.size)}.pdf`,
      fileName: `seed-${String(db.documents.size)}.pdf`,
      mimeType: PDF,
      projectId: world.p1.id,
      organizationId: world.orgA,
      createdById: world.analystA.id,
      version: {
        fileKey: `key-${String(db.versions.size)}`,
        contentHash: `hash-${String(db.versions.size)}`,
        mimeType: PDF,
        sizeBytes: 10,
      },
    });
    const document = db.documents.get(created.id);
    if (document) document.status = status;
    for (let i = 0; i < chunks; i += 1) {
      db.chunks.set(`c-${created.id}-${String(i)}`, {
        id: `c-${created.id}-${String(i)}`,
        chunkIndex: i,
        headingPath: [`Page ${String(i + 1)}`],
        content: `chunk ${String(i)}`,
        documentVersionId: created.versionId,
        contextNoteId: null,
        projectId: world.p1.id,
        organizationId: world.orgA,
      });
    }
    return created;
  }
});
