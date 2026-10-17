import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

const queue = vi.hoisted(() => ({ enqueueJob: vi.fn() }));
const llm = vi.hoisted(() => ({ run: vi.fn() }));

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
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);
vi.mock(
  './report.repository.js',
  async () => (await import('../../test/fake-report.js')).reportRepository,
);

import { createApp } from '../../app.js';
import { addKnowledge, db, type FakeUser } from '../../test/fake-db.js';
import { addQuestion, addSummary, qdb } from '../../test/fake-questions.js';
import { rdb, reportRepository } from '../../test/fake-report.js';
import { as, login } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';
import { createReportGeneration } from './report.generation.js';
import { reportService } from './report.runtime.js';

const app = createApp({ rateLimit: false });
const generation = createReportGeneration({
  repo: reportRepository,
  llm,
  transaction: async (fn) => fn({} as never),
});

const NARRATIVE = {
  objectives: ['Invoice customers on time'],
  scope: { inScope: ['Invoicing'], outOfScope: [] },
  roles: [{ name: 'Accountant', description: 'Issues invoices' }],
  risks: [{ title: 'Unclear tax rules', description: 'Tax is undecided', severity: 'HIGH' }],
  confidence: 'Reasonable.',
};

describe('report routes', () => {
  let world: World;
  const base = () => `/api/projects/${world.p1.id}/report`;
  const scope = () => ({ organizationId: world.orgA, projectId: world.p1.id });
  const asUser = (user: FakeUser) => login(app, user.email, PASSWORD);

  const addItem = (title = 'Create invoice') =>
    addKnowledge('requirements', {
      ...scope(),
      sourceChunkId: randomUUID(),
      title,
      description: 'Text',
    });

  /** A project with a summary and one requirement, ready for a report. */
  function seed() {
    addSummary(scope());
    return addItem();
  }

  async function generateDraft(who: FakeUser = world.analystA): Promise<number> {
    const res = await as(app, await asUser(who), 'post', `${base()}/generate`);
    expect(res.status).toBe(202);
    const created = rdb.versions.find((v) => v.version === res.body.version);
    await generation.generateContent({ ...scope(), reportVersionId: created?.id ?? '' });
    return res.body.version as number;
  }

  async function submitted(who: FakeUser = world.analystA): Promise<number> {
    const version = await generateDraft(who);
    const res = await as(app, await asUser(who), 'post', `${base()}/versions/${version}/submit`);
    expect(res.status).toBe(204);
    return version;
  }

  const decide = async (who: FakeUser, version: number, action: string, body: object = {}) =>
    as(app, await asUser(who), 'post', `${base()}/versions/${version}/${action}`).send(body);

  const statusOf = async (version: number) =>
    (await as(app, await asUser(world.viewerA), 'get', `${base()}/versions/${version}`)).body;

  beforeEach(async () => {
    vi.clearAllMocks();
    world = await buildWorld();
    qdb.reset();
    rdb.reset();
    queue.enqueueJob.mockReset().mockResolvedValue('job-1');
    llm.run.mockReset().mockResolvedValue({ output: NARRATIVE });
  });

  describe('permission matrix', () => {
    it('requires authentication', async () => {
      expect((await request(app).get(`${base()}/readiness`)).status).toBe(401);
    });

    it.each([
      ['viewerA', 200],
      ['approverA', 200],
      ['analystA', 200],
      ['ownerA', 200],
      ['adminA', 200],
      ['outsiderA', 404],
      ['userB', 404],
    ] as const)('%s reading readiness gets %i', async (who, status) => {
      expect((await as(app, await asUser(world[who]), 'get', `${base()}/readiness`)).status).toBe(
        status,
      );
    });

    it.each([
      ['viewerA', 403],
      ['approverA', 403],
      ['analystA', 202],
      ['ownerA', 202],
      ['adminA', 202],
      ['outsiderA', 404],
      ['userB', 404],
    ] as const)('%s generating gets %i', async (who, status) => {
      seed();
      expect((await as(app, await asUser(world[who]), 'post', `${base()}/generate`)).status).toBe(
        status,
      );
    });

    it.each([
      ['viewerA', 403],
      ['analystA', 403],
      ['approverA', 204],
      ['ownerA', 204],
      ['adminA', 204],
      ['outsiderA', 404],
      ['userB', 404],
    ] as const)('%s approving gets %i', async (who, status) => {
      seed();
      const version = await submitted(world.analystA);
      expect((await decide(world[who], version, 'approve')).status).toBe(status);
    });

    it('does not show another project’s report', async () => {
      seed();
      await generateDraft();
      const res = await as(
        app,
        await asUser(world.ownerA),
        'get',
        `/api/projects/${world.p2.id}/report/versions`,
      );
      expect(res.body).toEqual([]);
    });
  });

  describe('blocked by CRITICAL questions', () => {
    it('lists the blocking questions as not ready', async () => {
      seed();
      const q = addQuestion({ ...scope(), priority: 'CRITICAL', content: 'Which tax?' });
      addQuestion({ ...scope(), priority: 'NORMAL' });
      const res = await as(app, await asUser(world.viewerA), 'get', `${base()}/readiness`);
      expect(res.body.ready).toBe(false);
      expect(res.body.blockingQuestions).toEqual([
        { id: q.id, text: 'Which tax?', priority: 'CRITICAL', reason: 'GAP' },
      ]);
    });

    it('is ready once the critical question is answered', async () => {
      seed();
      const q = addQuestion({ ...scope(), priority: 'CRITICAL' });
      q.status = 'ANSWERED';
      const res = await as(app, await asUser(world.viewerA), 'get', `${base()}/readiness`);
      expect(res.body).toMatchObject({ ready: true, hasSummary: true, blockingQuestions: [] });
    });

    it('refuses to generate with a 409', async () => {
      seed();
      addQuestion({ ...scope(), priority: 'CRITICAL' });
      const res = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(res.status).toBe(409);
      expect(rdb.versions).toHaveLength(0);
      expect(queue.enqueueJob).not.toHaveBeenCalled();
    });

    it('refuses to generate before the project has a summary', async () => {
      addItem();
      const res = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(res.status).toBe(409);
    });

    it('refuses to submit when a critical question opened after generation', async () => {
      seed();
      const version = await generateDraft();
      addQuestion({ ...scope(), priority: 'CRITICAL' });
      const res = await as(
        app,
        await asUser(world.analystA),
        'post',
        `${base()}/versions/${version}/submit`,
      );
      expect(res.status).toBe(409);
    });

    it('refuses to approve but still allows a rejection', async () => {
      seed();
      const version = await submitted();
      addQuestion({ ...scope(), priority: 'CRITICAL' });
      expect((await decide(world.approverA, version, 'approve')).status).toBe(409);
      expect(
        (
          await decide(world.approverA, version, 'approve-with-conditions', {
            conditions: [{ text: 'x' }],
          })
        ).status,
      ).toBe(409);
      expect((await decide(world.approverA, version, 'reject', { reason: 'Not yet' })).status).toBe(
        204,
      );
    });
  });

  describe('generating and reading', () => {
    it('starts a GENERATING version, queues the job and audits it', async () => {
      seed();
      const res = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(res.body).toEqual({ version: 1 });
      expect(rdb.versions[0]?.status).toBe('GENERATING');
      expect(queue.enqueueJob).toHaveBeenCalledWith('generate-report', {
        ...scope(),
        reportVersionId: rdb.versions[0]?.id,
      });
      expect(db.audit.some((a) => a.entity === 'ReportVersion' && a.action === 'CREATE')).toBe(
        true,
      );
    });

    it('refuses a second generate while one is running', async () => {
      seed();
      await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      const again = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(again.status).toBe(409);
    });

    it('fails the version and returns 503 when the job cannot be queued', async () => {
      seed();
      queue.enqueueJob.mockRejectedValue(new Error('down'));
      const res = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(res.status).toBe(503);
      expect(rdb.versions[0]?.status).toBe('FAILED');
    });

    it('builds the facts from the records and only the narrative from the model', async () => {
      const item = seed();
      addKnowledge('modules', {
        ...scope(),
        sourceChunkId: randomUUID(),
        title: 'Billing',
        status: 'CONFIRMED',
      });
      const version = await generateDraft();
      const body = await statusOf(version);
      expect(body.status).toBe('DRAFT');
      expect(body.content.narrative.objectives).toEqual(['Invoice customers on time']);
      expect(body.content.requirements).toEqual([
        expect.objectContaining({ id: item.id, title: 'Create invoice' }),
      ]);
      expect(body.content.modules).toEqual([expect.objectContaining({ name: 'Billing' })]);
      expect(body.content.counts.requirements.OPEN).toBe(1);
    });

    it('lists versions newest first with isLatest', async () => {
      seed();
      await generateDraft();
      await generateDraft();
      const res = await as(app, await asUser(world.viewerA), 'get', `${base()}/versions`);
      expect(
        res.body.map((v: { version: number; isLatest: boolean }) => [v.version, v.isLatest]),
      ).toEqual([
        [2, true],
        [1, false],
      ]);
    });

    it('returns 404 for a missing version and 400 for a bad one', async () => {
      const session = await asUser(world.viewerA);
      expect((await as(app, session, 'get', `${base()}/versions/9`)).status).toBe(404);
      expect((await as(app, session, 'get', `${base()}/versions/0`)).status).toBe(400);
    });
  });

  describe('submit and decide', () => {
    it('submits a draft and records who and when', async () => {
      seed();
      const version = await submitted();
      const body = await statusOf(version);
      expect(body).toMatchObject({ status: 'SUBMITTED', submittedBy: { id: world.analystA.id } });
      expect(body.submittedAt).toEqual(expect.any(String));
    });

    it('cannot submit twice or submit a non-draft', async () => {
      seed();
      const version = await submitted();
      const again = await as(
        app,
        await asUser(world.analystA),
        'post',
        `${base()}/versions/${version}/submit`,
      );
      expect(again.status).toBe(409);
    });

    it('approves, stores the approver, comment and baseline, and audits it', async () => {
      seed();
      const version = await submitted();
      expect(
        (await decide(world.approverA, version, 'approve', { comment: 'Looks right' })).status,
      ).toBe(204);
      const body = await statusOf(version);
      expect(body.status).toBe('APPROVED');
      expect(body.decisionDetail).toMatchObject({
        decision: 'APPROVED',
        comment: 'Looks right',
        decidedBy: { id: world.approverA.id },
        conditions: [],
      });
      expect(body.decisionDetail.baselineHash).toMatch(/^[0-9a-f]{64}$/);
      const audit = db.audit.find((a) => a.entity === 'Approval');
      expect(audit).toMatchObject({ action: 'APPROVE', userId: world.approverA.id });
    });

    it('requires a reason to reject and audits the rejection', async () => {
      seed();
      const version = await submitted();
      expect((await decide(world.approverA, version, 'reject', {})).status).toBe(400);
      expect((await decide(world.approverA, version, 'reject', { reason: '  ' })).status).toBe(400);
      expect(
        (await decide(world.approverA, version, 'reject', { reason: 'Rules are missing' })).status,
      ).toBe(204);
      const body = await statusOf(version);
      expect(body).toMatchObject({
        status: 'REJECTED',
        decisionDetail: { comment: 'Rules are missing' },
      });
      expect(db.audit.some((a) => a.action === 'REJECT' && a.entity === 'Approval')).toBe(true);
    });

    it('cannot decide a draft, or decide twice', async () => {
      seed();
      const draft = await generateDraft();
      expect((await decide(world.approverA, draft, 'approve')).status).toBe(409);
      const version = await submitted();
      expect((await decide(world.approverA, version, 'approve')).status).toBe(204);
      expect(
        (await decide(world.approverA, version, 'reject', { reason: 'Changed my mind' })).status,
      ).toBe(409);
    });

    it('only the newest version can be submitted or decided', async () => {
      seed();
      const first = await submitted();
      await generateDraft();
      expect((await decide(world.approverA, first, 'approve')).status).toBe(409);
      const second = await as(
        app,
        await asUser(world.analystA),
        'post',
        `${base()}/versions/2/submit`,
      );
      expect(second.status).toBe(204);
    });

    it('lets an approver reject a report that went stale, so it does not stay pending', async () => {
      seed();
      const version = await submitted();
      addItem('Send reminder');
      expect((await decide(world.approverA, version, 'approve')).status).toBe(409);
      expect(
        (
          await decide(world.approverA, version, 'approve-with-conditions', {
            conditions: [{ text: 'x' }],
          })
        ).status,
      ).toBe(409);
      expect(
        (await decide(world.approverA, version, 'reject', { reason: 'Out of date' })).status,
      ).toBe(204);
      expect((await statusOf(version)).status).toBe('REJECTED');
    });

    it('refuses to decide a report that is out of step with the project', async () => {
      seed();
      const version = await submitted();
      addItem('Send reminder');
      const res = await decide(world.approverA, version, 'approve');
      expect(res.status).toBe(409);
      expect((await statusOf(version)).status).toBe('SUBMITTED');
    });
  });

  describe('self-approval rule', () => {
    it('blocks an owner who submitted when another owner exists', async () => {
      seed();
      const second = db.users.get(world.analystA.id) as FakeUser;
      db.members.set('m2', {
        id: 'm2',
        userId: second.id,
        projectId: world.p1.id,
        organizationId: world.orgA,
        role: 'OWNER',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      const version = await submitted(world.ownerA);
      const res = await decide(world.ownerA, version, 'approve');
      expect(res.status).toBe(403);
      expect((await decide(world.approverA, version, 'approve')).status).toBe(204);
    });

    it('lets the sole owner approve their own report', async () => {
      addSummary({ organizationId: world.orgA, projectId: world.p2.id });
      addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p2.id,
        sourceChunkId: randomUUID(),
        title: 'Only item',
      });
      const owner = await asUser(world.ownerA);
      const p2 = `/api/projects/${world.p2.id}/report`;
      const generated = await as(app, owner, 'post', `${p2}/generate`);
      await generation.generateContent({
        organizationId: world.orgA,
        projectId: world.p2.id,
        reportVersionId: rdb.versions[0]?.id ?? '',
      });
      expect(generated.status).toBe(202);
      expect((await as(app, owner, 'post', `${p2}/versions/1/submit`)).status).toBe(204);
      expect((await as(app, owner, 'post', `${p2}/versions/1/approve`).send({})).status).toBe(204);
    });

    it('blocks an org admin who submitted their own report', async () => {
      seed();
      const version = await submitted(world.adminA);
      expect((await decide(world.adminA, version, 'approve')).status).toBe(403);
      expect((await decide(world.approverA, version, 'approve')).status).toBe(204);
    });
  });

  describe('approve with conditions', () => {
    it('stores the conditions and lets an approver mark them met', async () => {
      seed();
      const version = await submitted();
      const res = await decide(world.approverA, version, 'approve-with-conditions', {
        comment: 'Go ahead',
        conditions: [{ text: 'Confirm tax rules' }, { text: 'Name a data owner' }],
      });
      expect(res.status).toBe(204);
      const body = await statusOf(version);
      expect(body.status).toBe('APPROVED_WITH_CONDITIONS');
      expect(body.decisionDetail.conditions.map((c: { text: string }) => c.text)).toEqual([
        'Confirm tax rules',
        'Name a data owner',
      ]);

      const conditionId = body.decisionDetail.conditions[0].id as string;
      const url = `${base()}/versions/${version}/conditions/${conditionId}`;
      expect(
        (await as(app, await asUser(world.analystA), 'patch', url).send({ status: 'MET' })).status,
      ).toBe(403);
      expect(
        (await as(app, await asUser(world.approverA), 'patch', url).send({ status: 'MET' })).status,
      ).toBe(204);
      const after = (await statusOf(version)).decisionDetail.conditions[0];
      expect(after).toMatchObject({ status: 'MET', updatedBy: { id: world.approverA.id } });
      expect(after.metAt).toEqual(expect.any(String));
      expect(db.audit.some((a) => a.entity === 'ApprovalCondition')).toBe(true);
    });

    it('needs at least one condition', async () => {
      seed();
      const version = await submitted();
      expect(
        (await decide(world.approverA, version, 'approve-with-conditions', { conditions: [] }))
          .status,
      ).toBe(400);
    });

    it('does not find a condition of another version or project', async () => {
      seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve-with-conditions', {
        conditions: [{ text: 'x' }],
      });
      const id = (await statusOf(version)).decisionDetail.conditions[0].id as string;
      const session = await asUser(world.ownerA);
      expect(
        (
          await as(app, session, 'patch', `${base()}/versions/9/conditions/${id}`).send({
            status: 'MET',
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await as(
            app,
            session,
            'patch',
            `/api/projects/${world.p2.id}/report/versions/${version}/conditions/${id}`,
          ).send({ status: 'MET' })
        ).status,
      ).toBe(404);
    });

    it('does not change conditions of a plain approval or a rejection', async () => {
      seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve-with-conditions', {
        conditions: [{ text: 'x' }],
      });
      const id = (await statusOf(version)).decisionDetail.conditions[0].id as string;
      addItem('Another');
      await as(app, await asUser(world.viewerA), 'get', `${base()}/versions/${version}`);
      const res = await as(
        app,
        await asUser(world.approverA),
        'patch',
        `${base()}/versions/${version}/conditions/${id}`,
      ).send({ status: 'MET' });
      expect(res.status).toBe(409);
    });
  });

  describe('OUTDATED after an item changes', () => {
    async function approved() {
      const item = seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve');
      return { item, version };
    }

    it('stays approved while nothing changes', async () => {
      const { version } = await approved();
      expect((await statusOf(version)).status).toBe('APPROVED');
    });

    it.each([
      ['an item is added', () => addItem('New one')],
      [
        'an item is edited',
        (item: { title: string }) => {
          item.title = 'Create invoice v2';
        },
      ],
      [
        'an answer confirms an item',
        (item: { status: string }) => {
          item.status = 'CONFIRMED';
        },
      ],
      [
        'an item is removed',
        (item: { id: string }) => {
          db.requirements.delete(item.id);
        },
      ],
    ])('becomes OUTDATED when %s', async (_name, change) => {
      const { item, version } = await approved();
      (change as (i: typeof item) => void)(item);
      const body = await statusOf(version);
      expect(body.status).toBe('OUTDATED');
      expect(body.outdatedAt).toEqual(expect.any(String));
      expect(
        db.audit.some(
          (a) =>
            a.entity === 'ReportVersion' &&
            a.entityId === rdb.versions[0]?.id &&
            a.action === 'UPDATE',
        ),
      ).toBe(true);
    });

    it('also becomes OUTDATED for approved-with-conditions, and shows in the list', async () => {
      seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve-with-conditions', {
        conditions: [{ text: 'x' }],
      });
      addItem('Changed');
      const list = await as(app, await asUser(world.viewerA), 'get', `${base()}/versions`);
      expect(list.body[0].status).toBe('OUTDATED');
    });

    it('is marked by the job-side refresh without anyone reading it', async () => {
      const { version } = await approved();
      addItem('Late change');
      expect(await reportService.refreshOutdated(world.orgA, world.p1.id)).toBe(1);
      expect(rdb.versions.find((v) => v.version === version)?.status).toBe('OUTDATED');
      expect(await reportService.refreshOutdated(world.orgA, world.p1.id)).toBe(0);
    });

    it('does not touch a rejected or draft version', async () => {
      seed();
      const draft = await generateDraft();
      addItem('Changed');
      expect((await statusOf(draft)).status).toBe('DRAFT');
    });

    it('cannot be submitted or decided again, so a new version is needed', async () => {
      const { version } = await approved();
      addItem('Changed');
      expect((await decide(world.approverA, version, 'approve')).status).toBe(409);
      const next = await generateDraft();
      expect(next).toBe(2);
    });
  });

  describe('baseline snapshot', () => {
    it('keeps the snapshot as it was when approved, however the project changes', async () => {
      const item = seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve');
      const stored = rdb.versions[0]?.approval;
      const before = JSON.stringify(stored?.baselineSnapshot);
      const hash = stored?.baselineHash;

      item.title = 'Renamed later';
      addItem('Added later');
      await statusOf(version);

      expect(JSON.stringify(rdb.versions[0]?.approval?.baselineSnapshot)).toBe(before);
      expect(rdb.versions[0]?.approval?.baselineHash).toBe(hash);
      expect(before).toContain('Create invoice');
      expect(before).not.toContain('Renamed later');
    });

    it('holds every item with its status, plus source and summary versions', async () => {
      seed();
      addKnowledge('rules', {
        ...scope(),
        sourceChunkId: randomUUID(),
        title: 'Net 30',
        status: 'ASSUMED',
      });
      const version = await submitted();
      await decide(world.approverA, version, 'approve');
      const snapshot = rdb.versions[0]?.approval?.baselineSnapshot as {
        items: { kind: string; status: string }[];
        summaryVersion: number;
        sources: object;
      };
      expect(snapshot.items.map((i) => [i.kind, i.status])).toEqual([
        ['requirement', 'OPEN'],
        ['rule', 'ASSUMED'],
      ]);
      expect(snapshot.summaryVersion).toBe(1);
      expect(snapshot.sources).toEqual({ documents: [], notes: [] });
    });

    it('offers no way to change a decision once made', async () => {
      seed();
      const version = await submitted();
      await decide(world.approverA, version, 'approve');
      const res = await decide(world.approverA, version, 'reject', { reason: 'Later regret' });
      expect(res.status).toBe(409);
      expect(rdb.versions[0]?.approval?.decision).toBe('APPROVED');
    });
  });

  describe('the generation job', () => {
    const run = (id: string) => generation.generateContent({ ...scope(), reportVersionId: id });

    it('writes content once; a retried job changes nothing', async () => {
      seed();
      await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      const id = rdb.versions[0]?.id ?? '';
      expect(await run(id)).toBe('generated');
      const content = JSON.stringify(rdb.versions[0]?.content);
      expect(await run(id)).toBe('already-done');
      expect(llm.run).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(rdb.versions[0]?.content)).toBe(content);
    });

    it('gives the report narrative room to be written', async () => {
      seed();
      await generateDraft();
      expect((llm.run.mock.calls[0]?.[0] as { maxOutputTokens: number }).maxOutputTokens).toBe(
        6_000,
      );
    });

    it('ignores a version of another project', async () => {
      seed();
      await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      const outcome = await generation.generateContent({
        organizationId: world.orgA,
        projectId: world.p2.id,
        reportVersionId: rdb.versions[0]?.id ?? '',
      });
      expect(outcome).toBe('skipped');
      expect(rdb.versions[0]?.status).toBe('GENERATING');
    });

    it('sends the model the summary, counts and questions, never item text', async () => {
      seed();
      addQuestion({ ...scope(), priority: 'HIGH', content: 'Who pays?' });
      await generateDraft();
      const call = llm.run.mock.calls[0]?.[0] as { promptName: string; user: string };
      expect(call.promptName).toBe('report');
      expect(call.user).toContain('Who pays?');
      expect(call.user).toContain('An ERP for invoicing.');
      expect(call.user).not.toContain('Create invoice');
    });

    it('fails the version on request, and only while it is generating', async () => {
      seed();
      await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      const payload = { ...scope(), reportVersionId: rdb.versions[0]?.id ?? '' };
      await generation.failGeneration(payload, 'The report could not be written.');
      expect(rdb.versions[0]).toMatchObject({
        status: 'FAILED',
        failureReason: 'The report could not be written.',
      });
      expect(await generation.generateContent(payload)).toBe('already-done');
    });

    it('a failed version can be followed by a new one', async () => {
      seed();
      await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      await generation.failGeneration(
        { ...scope(), reportVersionId: rdb.versions[0]?.id ?? '' },
        'x',
      );
      const next = await as(app, await asUser(world.analystA), 'post', `${base()}/generate`);
      expect(next.body).toEqual({ version: 2 });
    });
  });
});
