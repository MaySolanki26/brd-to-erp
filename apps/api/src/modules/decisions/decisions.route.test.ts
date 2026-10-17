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
  './decisions.repository.js',
  async () => (await import('../../test/fake-questions.js')).decisionsRepositoryModule,
);

import { createApp } from '../../app.js';
import { logger } from '../../lib/logger.js';
import { login } from '../../test/http.js';
import { as } from '../../test/http.js';
import { addAnswer, addDecision, addQuestion, qdb } from '../../test/fake-questions.js';
import { PASSWORD, buildWorld, type World } from '../../test/world.js';

const app = createApp({ rateLimit: false });
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const state = (status: string, title: string, description: string | null = null) => ({
  status,
  title,
  description,
});

describe('decisions routes', () => {
  let world: World;
  const base = (projectId: string) => `/api/projects/${projectId}/decisions`;
  const scope = () => ({ organizationId: world.orgA, projectId: world.p1.id });

  /** A decision with its question and answer, as the apply-answer job would leave them. */
  function decide(
    overrides: Partial<Parameters<typeof addDecision>[0]> = {},
    text = 'Q?',
    answerText = 'A.',
  ) {
    const question = addQuestion({ ...scope(), content: text, status: 'ANSWERED', version: 2 });
    const answer = addAnswer({
      ...scope(),
      questionId: question.id,
      answeredById: world.analystA.id,
      content: answerText,
    });
    return addDecision({
      ...scope(),
      questionId: question.id,
      answerId: answer.id,
      decidedById: world.analystA.id,
      ...overrides,
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    world = await buildWorld();
    qdb.reset();
  });

  it('requires authentication', async () => {
    expect((await request(app).get(base(world.p1.id))).status).toBe(401);
  });

  it('is empty before anything was decided', async () => {
    const session = await login(app, world.viewerA.email, PASSWORD);
    const res = await as(app, session, 'get', base(world.p1.id));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('lists newest first with who decided, the question and the answer', async () => {
    decide({}, 'older question', 'older answer');
    decide({}, 'newer question', 'newer answer');
    const session = await login(app, world.viewerA.email, PASSWORD);

    const { items } = (await as(app, session, 'get', base(world.p1.id))).body;
    expect(items.map((d: { question: { text: string } }) => d.question.text)).toEqual([
      'newer question',
      'older question',
    ]);
    expect(items[0]).toMatchObject({
      answer: 'newer answer',
      summary: 'Reminders go out after 7 days.',
      decidedBy: { id: world.analystA.id, name: world.analystA.name },
    });
    expect(typeof items[0].decidedAt).toBe('string');
  });

  it('maps changes to before and after with the new title, and carries the reason', async () => {
    decide({
      changes: [
        {
          kind: 'requirement',
          id: ID_A,
          before: state('OPEN', 'Remind customers', null),
          after: state('CONFIRMED', 'Remind customers after 7 days', 'Sent by email'),
          reason: 'The answer fixes the delay.',
        },
        {
          kind: 'rule',
          id: ID_B,
          before: state('ASSUMED', 'Limit 10k', null),
          after: state('ASSUMED', 'Limit 10k', null),
        },
      ],
    });
    const session = await login(app, world.viewerA.email, PASSWORD);
    const [decision] = (await as(app, session, 'get', base(world.p1.id))).body.items;

    expect(decision.changes).toEqual([
      {
        kind: 'requirement',
        id: ID_A,
        title: 'Remind customers after 7 days',
        before: { status: 'OPEN', title: 'Remind customers', description: null },
        after: {
          status: 'CONFIRMED',
          title: 'Remind customers after 7 days',
          description: 'Sent by email',
        },
        reason: 'The answer fixes the delay.',
      },
      {
        kind: 'rule',
        id: ID_B,
        title: 'Limit 10k',
        before: { status: 'ASSUMED', title: 'Limit 10k', description: null },
        after: { status: 'ASSUMED', title: 'Limit 10k', description: null },
        reason: null,
      },
    ]);
  });

  it('maps conflicts and tolerates a missing title', async () => {
    decide({
      conflicts: [
        {
          kind: 'rule',
          id: ID_A,
          title: 'Limit is 5k',
          explanation: 'The answer says 10k.',
          moduleId: null,
        },
        { kind: 'module', id: ID_B, explanation: 'Contradicts the module scope.' },
      ],
    });
    const session = await login(app, world.viewerA.email, PASSWORD);
    const [decision] = (await as(app, session, 'get', base(world.p1.id))).body.items;
    expect(decision.conflicts).toEqual([
      { kind: 'rule', id: ID_A, title: 'Limit is 5k', explanation: 'The answer says 10k.' },
      { kind: 'module', id: ID_B, title: null, explanation: 'Contradicts the module scope.' },
    ]);
  });

  it('drops entries that do not match the stored shape instead of failing the timeline', async () => {
    decide({
      changes: [
        {
          kind: 'requirement',
          id: ID_A,
          before: state('OPEN', 'A'),
          after: state('CONFIRMED', 'A'),
        },
        { kind: 'nonsense', id: ID_B },
        'garbage',
        { kind: 'rule', id: 'not-a-uuid', before: state('OPEN', 'x'), after: state('OPEN', 'x') },
      ],
      conflicts: [{ nope: true }],
    });
    const session = await login(app, world.viewerA.email, PASSWORD);
    const res = await as(app, session, 'get', base(world.p1.id));
    expect(res.status).toBe(200);
    expect(res.body.items[0].changes).toHaveLength(1);
    expect(res.body.items[0].conflicts).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('treats non-array stored JSON as empty', async () => {
    decide({ changes: null, conflicts: { oops: true } });
    const session = await login(app, world.viewerA.email, PASSWORD);
    const [decision] = (await as(app, session, 'get', base(world.p1.id))).body.items;
    expect(decision.changes).toEqual([]);
    expect(decision.conflicts).toEqual([]);
  });

  it('pages the timeline and caps the page size at 100', async () => {
    for (let i = 0; i < 5; i += 1) decide({}, `q${String(i)}`);
    const session = await login(app, world.viewerA.email, PASSWORD);
    const page = await as(app, session, 'get', `${base(world.p1.id)}?page=2&pageSize=2`);
    expect(page.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
    expect(page.body.items).toHaveLength(2);
    expect((await as(app, session, 'get', `${base(world.p1.id)}?pageSize=101`)).status).toBe(400);
  });

  it('never shows decisions from another project', async () => {
    decide({}, 'mine');
    const other = addQuestion({
      organizationId: world.orgA,
      projectId: world.p2.id,
      content: 'theirs',
      status: 'ANSWERED',
    });
    const answer = addAnswer({
      organizationId: world.orgA,
      projectId: world.p2.id,
      questionId: other.id,
      answeredById: world.ownerA.id,
    });
    addDecision({
      organizationId: world.orgA,
      projectId: world.p2.id,
      questionId: other.id,
      answerId: answer.id,
      decidedById: world.ownerA.id,
    });

    const session = await login(app, world.viewerA.email, PASSWORD);
    const res = await as(app, session, 'get', base(world.p1.id));
    expect(res.body.items.map((d: { question: { text: string } }) => d.question.text)).toEqual([
      'mine',
    ]);
  });

  it('is readable by every role and hidden from outsiders and other organizations', async () => {
    decide();
    for (const user of [
      world.viewerA,
      world.approverA,
      world.analystA,
      world.ownerA,
      world.adminA,
    ]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(200);
    }
    for (const user of [world.outsiderA, world.adminB, world.userB]) {
      const session = await login(app, user.email, PASSWORD);
      expect((await as(app, session, 'get', base(world.p1.id))).status).toBe(404);
    }
  });
});
