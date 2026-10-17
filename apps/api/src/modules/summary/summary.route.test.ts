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
  './summary.repository.js',
  async () => (await import('../../test/fake-questions.js')).summaryRepositoryModule,
);

import { createApp } from '../../app.js';
import { logger } from '../../lib/logger.js';
import { addKnowledge, type FakeUser } from '../../test/fake-db.js';
import { addSummary, qdb } from '../../test/fake-questions.js';
import { as, login } from '../../test/http.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });
const GONE = '99999999-9999-4999-8999-999999999999';

describe('summary routes', () => {
  let world: World;
  const base = (projectId: string) => `/api/projects/${projectId}/summary`;
  const scope = () => ({ organizationId: world.orgA, projectId: world.p1.id });
  const asUser = (user: FakeUser) => login(app, user.email, PASSWORD);

  const content = (extra: Record<string, unknown> = {}) => ({
    overview: 'An ERP for invoicing.',
    modules: [],
    keyRequirements: [],
    keyRules: [],
    assumptions: [],
    staleItems: [],
    ...extra,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    world = await buildWorld();
    qdb.reset();
    queue.enqueueJob.mockReset().mockResolvedValue('job-1');
  });

  describe('reading', () => {
    it('requires authentication', async () => {
      expect((await request(app).get(base(world.p1.id))).status).toBe(401);
    });

    it('returns nothing yet when no summary was generated', async () => {
      const res = await as(app, await asUser(world.viewerA), 'get', base(world.p1.id));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ summary: null, versions: [] });
    });

    it('returns the latest version and the list of versions, newest first', async () => {
      addSummary({ ...scope(), content: content({ overview: 'v1 text' }) });
      addSummary({
        ...scope(),
        content: content({ overview: 'v2 text' }),
        basedOn: { requirements: 5, rules: 2 },
      });

      const res = await as(app, await asUser(world.viewerA), 'get', base(world.p1.id));
      expect(res.body.summary).toMatchObject({
        version: 2,
        content: { overview: 'v2 text' },
        basedOn: { requirements: 5, rules: 2 },
      });
      expect(res.body.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    });

    it('returns an older version when asked, with the full version list', async () => {
      addSummary({ ...scope(), content: content({ overview: 'v1 text' }) });
      addSummary({ ...scope(), content: content({ overview: 'v2 text' }) });
      const res = await as(
        app,
        await asUser(world.viewerA),
        'get',
        `${base(world.p1.id)}?version=1`,
      );
      expect(res.body.summary).toMatchObject({ version: 1, content: { overview: 'v1 text' } });
      expect(res.body.versions).toHaveLength(2);
    });

    it('returns 404 for a version that does not exist and 400 for a bad one', async () => {
      addSummary({ ...scope() });
      const session = await asUser(world.viewerA);
      expect((await as(app, session, 'get', `${base(world.p1.id)}?version=9`)).status).toBe(404);
      expect((await as(app, session, 'get', `${base(world.p1.id)}?version=0`)).status).toBe(400);
      expect((await as(app, session, 'get', `${base(world.p1.id)}?version=abc`)).status).toBe(400);
    });

    it('adds current titles to the ids the summary stores', async () => {
      const requirement = addKnowledge('requirements', {
        ...scope(),
        sourceChunkId: 'c',
        title: 'Invoice approval',
      });
      const rule = addKnowledge('rules', { ...scope(), sourceChunkId: 'c', title: 'Limit is 10k' });
      const module = addKnowledge('modules', { ...scope(), sourceChunkId: 'c', title: 'Finance' });
      addSummary({
        ...scope(),
        content: content({
          modules: [{ moduleId: module.id, name: 'Finance', summary: 'Money.' }],
          keyRequirements: [{ requirementId: requirement.id, why: 'Core flow.' }],
          keyRules: [{ ruleId: rule.id, why: 'Controls spend.' }],
          assumptions: [{ itemKind: 'rule', itemId: rule.id, statement: 'Limit applies to all.' }],
          staleItems: [{ itemKind: 'requirement', itemId: requirement.id }],
        }),
      });

      const { summary } = (await as(app, await asUser(world.viewerA), 'get', base(world.p1.id)))
        .body;
      expect(summary.content.modules).toEqual([
        { id: module.id, name: 'Finance', summary: 'Money.' },
      ]);
      expect(summary.content.keyRequirements).toEqual([
        { id: requirement.id, title: 'Invoice approval', why: 'Core flow.' },
      ]);
      expect(summary.content.keyRules).toEqual([
        { id: rule.id, title: 'Limit is 10k', why: 'Controls spend.' },
      ]);
      expect(summary.content.assumptions).toEqual([
        { kind: 'rule', id: rule.id, title: 'Limit is 10k', statement: 'Limit applies to all.' },
      ]);
      expect(summary.content.staleItems).toEqual([
        { kind: 'requirement', id: requirement.id, title: 'Invoice approval' },
      ]);
    });

    it('leaves out items that no longer exist or belong to another project', async () => {
      const foreign = addKnowledge('requirements', {
        organizationId: world.orgA,
        projectId: world.p2.id,
        sourceChunkId: 'c',
        title: 'Other project requirement',
      });
      addSummary({
        ...scope(),
        content: content({
          keyRequirements: [
            { requirementId: GONE, why: 'deleted' },
            { requirementId: foreign.id, why: 'foreign' },
          ],
          assumptions: [{ itemKind: 'rule', itemId: GONE, statement: 'gone' }],
          staleItems: [{ itemKind: 'module', itemId: GONE }],
        }),
      });
      const { summary } = (await as(app, await asUser(world.viewerA), 'get', base(world.p1.id)))
        .body;
      expect(summary.content.keyRequirements).toEqual([]);
      expect(summary.content.assumptions).toEqual([]);
      expect(summary.content.staleItems).toEqual([]);
    });

    it('tolerates unreadable basedOn but fails clearly when the content is unreadable', async () => {
      addSummary({ ...scope(), basedOn: 'nonsense' });
      const session = await asUser(world.viewerA);
      expect((await as(app, session, 'get', base(world.p1.id))).body.summary.basedOn).toEqual({});

      addSummary({ ...scope(), content: { overview: 5 } });
      const broken = await as(app, session, 'get', base(world.p1.id));
      expect(broken.status).toBe(500);
      expect(broken.body.error.message).toBe('The summary could not be read');
      expect(logger.error).toHaveBeenCalled();
    });

    it('only shows this project’s versions', async () => {
      addSummary({ ...scope(), content: content({ overview: 'mine' }) });
      addSummary({
        organizationId: world.orgA,
        projectId: world.p2.id,
        content: content({ overview: 'theirs' }),
      });
      const res = await as(app, await asUser(world.viewerA), 'get', base(world.p1.id));
      expect(res.body.summary.content.overview).toBe('mine');
      expect(res.body.versions).toHaveLength(1);
    });

    it('is readable by every role and hidden from outsiders and other organizations', async () => {
      addSummary({ ...scope() });
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
  });

  describe('refreshing', () => {
    const refresh = (session: Awaited<ReturnType<typeof login>>, projectId = world.p1.id) =>
      as(app, session, 'post', `${base(projectId)}/refresh`).send({});

    it('queues a refresh for analysts, owners and organization admins', async () => {
      for (const user of [world.analystA, world.ownerA, world.adminA]) {
        const res = await refresh(await asUser(user));
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ requested: true });
      }
      expect(queue.enqueueJob).toHaveBeenCalledTimes(3);
      expect(queue.enqueueJob).toHaveBeenCalledWith('refresh-summary', {
        organizationId: world.orgA,
        projectId: world.p1.id,
      });
    });

    it('is refused for viewers and approvers, and hidden from outsiders', async () => {
      for (const user of [world.viewerA, world.approverA]) {
        expect((await refresh(await asUser(user))).status).toBe(403);
      }
      for (const user of [world.outsiderA, world.adminB]) {
        expect((await refresh(await asUser(user))).status).toBe(404);
      }
      expect(queue.enqueueJob).not.toHaveBeenCalled();
    });

    it('answers 503 when the job cannot be queued', async () => {
      queue.enqueueJob.mockRejectedValue(new Error('boss down'));
      const res = await refresh(await asUser(world.analystA));
      expect(res.status).toBe(503);
      expect(res.body.error.message).toMatch(/Could not start the summary refresh/);
    });
  });
});
