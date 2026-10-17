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
  '../audit/audit.repository.js',
  async () => (await import('../../test/fake-db.js')).auditRepositoryModule,
);
vi.mock(
  './questions.repository.js',
  async () => (await import('../../test/fake-questions.js')).questionsRepositoryModule,
);

import { MAX_ANSWER_CHARS } from '@brd/shared';
import { createApp } from '../../app.js';
import { logger } from '../../lib/logger.js';
import { addKnowledge, db, type FakeUser } from '../../test/fake-db.js';
import { addAnswer, addQuestion, qdb } from '../../test/fake-questions.js';
import { as, login, type Session } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });

describe('questions routes', () => {
  let world: World;
  let analyst: Session;

  const base = (projectId: string) => `/api/projects/${projectId}/questions`;
  const asUser = (user: FakeUser) => login(app, user.email, PASSWORD);
  const scope = () => ({ organizationId: world.orgA, projectId: world.p1.id });
  const answer = (session: Session, id: string, body: object, projectId = world.p1.id) =>
    as(app, session, 'post', `${base(projectId)}/${id}/answer`).send(body);
  const dismiss = (session: Session, id: string, body: object, projectId = world.p1.id) =>
    as(app, session, 'post', `${base(projectId)}/${id}/dismiss`).send(body);

  beforeEach(async () => {
    vi.clearAllMocks();
    world = await buildWorld();
    qdb.reset();
    analyst = await asUser(world.analystA);
    queue.enqueueJob.mockReset().mockResolvedValue('job-1');
  });

  describe('listing', () => {
    it('requires authentication', async () => {
      expect((await request(app).get(base(world.p1.id))).status).toBe(401);
    });

    it('orders the most urgent first and the oldest first within a priority', async () => {
      const normal = addQuestion({ ...scope(), content: 'normal', priority: 'NORMAL' });
      const highOld = addQuestion({ ...scope(), content: 'high old', priority: 'HIGH' });
      const critical = addQuestion({ ...scope(), content: 'critical', priority: 'CRITICAL' });
      const highNew = addQuestion({ ...scope(), content: 'high new', priority: 'HIGH' });

      const res = await as(app, analyst, 'get', base(world.p1.id));
      expect(res.status).toBe(200);
      expect(res.body.items.map((q: { id: string }) => q.id)).toEqual([
        critical.id,
        highOld.id,
        highNew.id,
        normal.id,
      ]);
      expect(res.body).toMatchObject({ page: 1, pageSize: 50, total: 4 });
    });

    it('shows each question with its module and linked items inline', async () => {
      const module = addKnowledge('modules', {
        ...scope(),
        sourceChunkId: 'c',
        title: 'Finance',
        status: 'CONFIRMED',
      });
      const requirement = addKnowledge('requirements', {
        ...scope(),
        sourceChunkId: 'c',
        title: 'Invoice approval',
        status: 'OPEN',
      });
      const rule = addKnowledge('rules', {
        ...scope(),
        sourceChunkId: 'c',
        title: 'Limit is 10k',
        status: 'ASSUMED',
      });
      addQuestion({
        ...scope(),
        moduleId: module.id,
        links: [
          { kind: 'requirement', id: requirement.id },
          { kind: 'rule', id: rule.id },
          { kind: 'module', id: module.id },
        ],
      });

      const [item] = (await as(app, analyst, 'get', base(world.p1.id))).body.items;
      expect(item.module).toEqual({ id: module.id, name: 'Finance' });
      expect(item.linkedItems).toEqual([
        { kind: 'requirement', id: requirement.id, title: 'Invoice approval', status: 'OPEN' },
        { kind: 'rule', id: rule.id, title: 'Limit is 10k', status: 'ASSUMED' },
        { kind: 'module', id: module.id, title: 'Finance', status: 'CONFIRMED' },
      ]);
    });

    it('shows the answer (and whether it was applied) or the dismissal on resolved questions', async () => {
      const answered = addQuestion({ ...scope(), status: 'ANSWERED', version: 2 });
      addAnswer({
        ...scope(),
        questionId: answered.id,
        answeredById: world.ownerA.id,
        content: 'After 7 days',
      });
      const dismissed = addQuestion({
        ...scope(),
        status: 'DISMISSED',
        version: 2,
        dismissReason: 'Out of scope',
        dismissedAt: new Date('2026-02-03T00:00:00Z'),
        dismissedById: world.ownerA.id,
      });

      const res = await as(app, analyst, 'get', base(world.p1.id));
      const byId = Object.fromEntries(res.body.items.map((q: { id: string }) => [q.id, q]));
      expect(byId[answered.id].answer).toMatchObject({
        text: 'After 7 days',
        answeredBy: { name: world.ownerA.name },
        applied: false,
      });
      expect(byId[answered.id].dismissal).toBeNull();
      expect(byId[dismissed.id].dismissal).toEqual({
        reason: 'Out of scope',
        at: '2026-02-03T00:00:00.000Z',
      });
      expect(byId[dismissed.id].answer).toBeNull();
    });

    it('marks an answer as applied once the job has run', async () => {
      const q = addQuestion({ ...scope(), status: 'ANSWERED', version: 2 });
      addAnswer({
        ...scope(),
        questionId: q.id,
        answeredById: world.ownerA.id,
        appliedAt: new Date(),
      });
      const [item] = (await as(app, analyst, 'get', base(world.p1.id))).body.items;
      expect(item.answer.applied).toBe(true);
    });

    it('filters by status, reason, priority and module, and by several at once', async () => {
      const module = addKnowledge('modules', { ...scope(), sourceChunkId: 'c', title: 'Sales' });
      const a = addQuestion({
        ...scope(),
        reason: 'GAP',
        priority: 'CRITICAL',
        moduleId: module.id,
      });
      addQuestion({ ...scope(), reason: 'CONFLICT', priority: 'CRITICAL' });
      addQuestion({ ...scope(), reason: 'GAP', priority: 'NORMAL', status: 'ANSWERED' });
      const ids = async (qs: string) =>
        (await as(app, analyst, 'get', `${base(world.p1.id)}?${qs}`)).body.items.map(
          (q: { id: string }) => q.id,
        );

      expect(await ids('status=OPEN')).toHaveLength(2);
      expect(await ids('status=ANSWERED')).toHaveLength(1);
      expect(await ids('reason=CONFLICT')).toHaveLength(1);
      expect(await ids('priority=CRITICAL')).toHaveLength(2);
      expect(await ids(`moduleId=${module.id}`)).toEqual([a.id]);
      expect(await ids('status=OPEN&reason=GAP&priority=CRITICAL')).toEqual([a.id]);
    });

    it('pages results and rejects page sizes above 100', async () => {
      for (let i = 0; i < 5; i += 1) addQuestion({ ...scope(), content: `q${String(i)}` });
      const page = await as(app, analyst, 'get', `${base(world.p1.id)}?page=2&pageSize=2`);
      expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(page.body.items).toHaveLength(2);
      expect((await as(app, analyst, 'get', `${base(world.p1.id)}?pageSize=101`)).status).toBe(400);
      expect((await as(app, analyst, 'get', `${base(world.p1.id)}?status=BOGUS`)).status).toBe(400);
    });

    it('never mixes in another project of the same organization', async () => {
      addQuestion({ ...scope(), content: 'mine' });
      addQuestion({ organizationId: world.orgA, projectId: world.p2.id, content: 'theirs' });
      const res = await as(app, analyst, 'get', base(world.p1.id));
      expect(res.body.items.map((q: { text: string }) => q.text)).toEqual(['mine']);
    });

    it('lets every project role read, and returns 404 to outsiders and other organizations', async () => {
      addQuestion(scope());
      for (const user of [
        world.viewerA,
        world.approverA,
        world.analystA,
        world.ownerA,
        world.adminA,
      ]) {
        expect((await as(app, await asUser(user), 'get', base(world.p1.id))).status).toBe(200);
      }
      for (const user of [world.outsiderA, world.adminB, world.userB]) {
        expect((await as(app, await asUser(user), 'get', base(world.p1.id))).status).toBe(404);
      }
    });

    it('rejects a malformed project id', async () => {
      expect((await as(app, analyst, 'get', base('not-a-uuid'))).status).toBe(400);
    });
  });

  describe('counts', () => {
    it('fills in zeros and reports open critical questions', async () => {
      const res = await as(app, analyst, 'get', `${base(world.p1.id)}/counts`);
      expect(res.body.counts).toEqual({
        byStatus: { OPEN: 0, ANSWERED: 0, DISMISSED: 0 },
        openByPriority: { CRITICAL: 0, HIGH: 0, NORMAL: 0 },
        openCritical: 0,
      });
    });

    it('counts statuses, and priorities for open questions only', async () => {
      addQuestion({ ...scope(), priority: 'CRITICAL' });
      addQuestion({ ...scope(), priority: 'CRITICAL' });
      addQuestion({ ...scope(), priority: 'HIGH' });
      addQuestion({ ...scope(), priority: 'CRITICAL', status: 'ANSWERED' });
      addQuestion({ ...scope(), status: 'DISMISSED' });
      addQuestion({ organizationId: world.orgA, projectId: world.p2.id, priority: 'CRITICAL' });

      const { counts } = (await as(app, analyst, 'get', `${base(world.p1.id)}/counts`)).body;
      expect(counts.byStatus).toEqual({ OPEN: 3, ANSWERED: 1, DISMISSED: 1 });
      expect(counts.openByPriority).toEqual({ CRITICAL: 2, HIGH: 1, NORMAL: 0 });
      expect(counts.openCritical).toBe(2);
    });

    it('is hidden from outsiders', async () => {
      const outsider = await asUser(world.outsiderA);
      expect((await as(app, outsider, 'get', `${base(world.p1.id)}/counts`)).status).toBe(404);
    });
  });

  describe('answering', () => {
    it('saves the answer, bumps the version, audits it and queues the job', async () => {
      const q = addQuestion(scope());
      const res = await answer(analyst, q.id, { answer: 'Remind after 7 days.', version: 1 });

      expect(res.status).toBe(201);
      expect(res.body.question).toMatchObject({
        id: q.id,
        status: 'ANSWERED',
        version: 2,
        answer: {
          text: 'Remind after 7 days.',
          applied: false,
          answeredBy: { id: world.analystA.id },
        },
      });
      const [stored] = [...qdb.answers.values()];
      expect(stored).toMatchObject({
        questionId: q.id,
        answeredById: world.analystA.id,
        projectId: world.p1.id,
      });
      expect(queue.enqueueJob).toHaveBeenCalledWith('apply-answer', {
        organizationId: world.orgA,
        projectId: world.p1.id,
        answerId: stored?.id,
      });
      expect(db.audit.some((a) => a.entity === 'Question' && a.entityId === q.id)).toBe(true);
    });

    it('trims the answer', async () => {
      const q = addQuestion(scope());
      await answer(analyst, q.id, { answer: '  Yes.  ', version: 1 });
      expect([...qdb.answers.values()][0]?.content).toBe('Yes.');
    });

    it('allows owners and organization admins, and refuses viewers and approvers', async () => {
      const q = addQuestion(scope());
      for (const user of [world.viewerA, world.approverA]) {
        expect((await answer(await asUser(user), q.id, { answer: 'x', version: 1 })).status).toBe(
          403,
        );
      }
      expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
      expect(
        (await answer(await asUser(world.adminA), q.id, { answer: 'ok', version: 1 })).status,
      ).toBe(201);
      const q2 = addQuestion(scope());
      expect(
        (await answer(await asUser(world.ownerA), q2.id, { answer: 'ok', version: 1 })).status,
      ).toBe(201);
    });

    it('returns 404 to outsiders, other organizations, and for another project’s question', async () => {
      const q = addQuestion(scope());
      for (const user of [world.outsiderA, world.adminB, world.userB]) {
        expect((await answer(await asUser(user), q.id, { answer: 'x', version: 1 })).status).toBe(
          404,
        );
      }
      const owner = await asUser(world.ownerA);
      expect((await answer(owner, q.id, { answer: 'x', version: 1 }, world.p2.id)).status).toBe(
        404,
      );
      expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
      expect(qdb.answers.size).toBe(0);
    });

    it('returns 404 for an unknown question', async () => {
      const res = await answer(analyst, '11111111-1111-4111-8111-111111111111', {
        answer: 'x',
        version: 1,
      });
      expect(res.status).toBe(404);
    });

    it('validates the body and rejects unknown fields', async () => {
      const q = addQuestion(scope());
      for (const body of [
        {},
        { answer: '', version: 1 },
        { answer: '   ', version: 1 },
        { answer: 'x' },
        { answer: 'x', version: 0 },
        { answer: 'x', version: 1.5 },
        { answer: 'x'.repeat(MAX_ANSWER_CHARS + 1), version: 1 },
        { answer: 'x', version: 1, status: 'DISMISSED' },
      ]) {
        expect((await answer(analyst, q.id, body)).status).toBe(400);
      }
      expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
      expect((await answer(analyst, 'not-a-uuid', { answer: 'x', version: 1 })).status).toBe(400);
      expect(
        (await answer(analyst, q.id, { answer: 'x'.repeat(MAX_ANSWER_CHARS), version: 1 })).status,
      ).toBe(201);
    });

    describe('conflicts (409)', () => {
      it('tells the second person who answered first', async () => {
        const q = addQuestion(scope());
        const owner = await asUser(world.ownerA);
        expect((await answer(analyst, q.id, { answer: 'first', version: 1 })).status).toBe(201);

        const late = await answer(owner, q.id, { answer: 'second', version: 1 });
        expect(late.status).toBe(409);
        expect(late.body.error.code).toBe('CONFLICT');
        expect(late.body.error.message).toBe(
          `This question was already answered by ${world.analystA.name}. Refresh to see the latest.`,
        );
        expect(qdb.answers.size).toBe(1);
        expect(queue.enqueueJob).toHaveBeenCalledTimes(1);
      });

      it('lets exactly one of two simultaneous answers win', async () => {
        const q = addQuestion(scope());
        const owner = await asUser(world.ownerA);
        const results = await Promise.all([
          answer(analyst, q.id, { answer: 'from analyst', version: 1 }),
          answer(owner, q.id, { answer: 'from owner', version: 1 }),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(qdb.answers.size).toBe(1);
        expect(queue.enqueueJob).toHaveBeenCalledTimes(1);
      });

      it('rejects an answer to a question that was dismissed meanwhile', async () => {
        const q = addQuestion(scope());
        const owner = await asUser(world.ownerA);
        await dismiss(owner, q.id, { reason: 'Not needed', version: 1 });

        const late = await answer(analyst, q.id, { answer: 'x', version: 1 });
        expect(late.status).toBe(409);
        expect(late.body.error.message).toBe(
          `This question was already dismissed by ${world.ownerA.name}. Refresh to see the latest.`,
        );
      });

      it('rejects a stale version even while the question is still open', async () => {
        const q = addQuestion({ ...scope(), version: 3 });
        const res = await answer(analyst, q.id, { answer: 'x', version: 2 });
        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe(
          'This question changed after you opened it. Refresh to see the latest.',
        );
        expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
      });

      it('rejects answering twice with the same version', async () => {
        const q = addQuestion(scope());
        await answer(analyst, q.id, { answer: 'one', version: 1 });
        expect((await answer(analyst, q.id, { answer: 'two', version: 1 })).status).toBe(409);
        expect((await answer(analyst, q.id, { answer: 'two', version: 2 })).status).toBe(409);
      });
    });

    it('keeps the answer when the job cannot be queued', async () => {
      queue.enqueueJob.mockRejectedValue(new Error('boss down'));
      const q = addQuestion(scope());
      const res = await answer(analyst, q.id, { answer: 'Remind after 7 days.', version: 1 });
      expect(res.status).toBe(201);
      expect(qdb.questions.get(q.id)?.status).toBe('ANSWERED');
      expect(qdb.answers.size).toBe(1);
      expect(logger.error).toHaveBeenCalled();
    });

    it('never writes the answer text to the logs or the audit trail', async () => {
      queue.enqueueJob.mockRejectedValue(new Error('boss down'));
      const secret = 'SECRET-CLIENT-DETAIL-4711';
      const q = addQuestion(scope());
      await answer(analyst, q.id, { answer: secret, version: 1 });
      const logged = JSON.stringify([
        (logger.error as ReturnType<typeof vi.fn>).mock.calls,
        (logger.warn as ReturnType<typeof vi.fn>).mock.calls,
        (logger.info as ReturnType<typeof vi.fn>).mock.calls,
        db.audit,
      ]);
      expect(logged).not.toContain(secret);
    });
  });

  describe('dismissing', () => {
    it('dismisses with a reason, bumps the version and audits it', async () => {
      const q = addQuestion(scope());
      const res = await dismiss(analyst, q.id, {
        reason: '  Out of scope for phase 1  ',
        version: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.question).toMatchObject({
        status: 'DISMISSED',
        version: 2,
        dismissal: { reason: 'Out of scope for phase 1' },
        answer: null,
      });
      expect(qdb.questions.get(q.id)).toMatchObject({ dismissedById: world.analystA.id });
      expect(queue.enqueueJob).not.toHaveBeenCalled();
      expect(db.audit.some((a) => a.entity === 'Question' && a.entityId === q.id)).toBe(true);
    });

    it('requires a reason and rejects unknown fields', async () => {
      const q = addQuestion(scope());
      for (const body of [
        { version: 1 },
        { reason: '', version: 1 },
        { reason: '  ', version: 1 },
        { reason: 'x'.repeat(501), version: 1 },
        { reason: 'x', version: 1, status: 'OPEN' },
      ]) {
        expect((await dismiss(analyst, q.id, body)).status).toBe(400);
      }
      expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
    });

    it('is refused for viewers and approvers, and hidden from outsiders', async () => {
      const q = addQuestion(scope());
      for (const user of [world.viewerA, world.approverA]) {
        expect((await dismiss(await asUser(user), q.id, { reason: 'x', version: 1 })).status).toBe(
          403,
        );
      }
      for (const user of [world.outsiderA, world.adminB]) {
        expect((await dismiss(await asUser(user), q.id, { reason: 'x', version: 1 })).status).toBe(
          404,
        );
      }
      expect(qdb.questions.get(q.id)?.status).toBe('OPEN');
    });

    it('returns 409 when the question was answered first, naming who answered', async () => {
      const q = addQuestion(scope());
      const owner = await asUser(world.ownerA);
      await answer(owner, q.id, { answer: 'done', version: 1 });
      const res = await dismiss(analyst, q.id, { reason: 'x', version: 1 });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        `This question was already answered by ${world.ownerA.name}. Refresh to see the latest.`,
      );
    });

    it('returns 409 for a stale version and 404 for an unknown question', async () => {
      const q = addQuestion({ ...scope(), version: 2 });
      expect((await dismiss(analyst, q.id, { reason: 'x', version: 1 })).status).toBe(409);
      expect(
        (
          await dismiss(analyst, '11111111-1111-4111-8111-111111111111', {
            reason: 'x',
            version: 1,
          })
        ).status,
      ).toBe(404);
    });
  });
});
