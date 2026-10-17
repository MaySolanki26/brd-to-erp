import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../lib/transaction.js';

const model = () => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  createManyAndReturn: vi.fn(),
  updateMany: vi.fn(),
  aggregate: vi.fn(),
});
const prismaMock = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof model>>);
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  claimAnswer,
  countOpenQuestions,
  createDecision,
  createSummary,
  findAnswerContext,
  insertQuestions,
  latestSummary,
  listQuestionKeys,
  loadItems,
  updateItem,
} from './understanding.repository.js';
import type { PlannedChange } from './plan-answer.js';

const O = 'org-1';
const P = 'project-1';
const NAMES = [
  'requirement',
  'businessRule',
  'module',
  'question',
  'questionLink',
  'answer',
  'decision',
  'projectSummary',
  'project',
];

function freshDb(): DbClient {
  for (const name of NAMES) prismaMock[name] = model();
  return prismaMock as unknown as DbClient;
}

const change = (kind: 'requirement' | 'rule' | 'module'): PlannedChange => ({
  kind,
  id: 'i1',
  before: { status: 'OPEN', title: 'Old', description: 'Old text' },
  after: { status: 'CONFIRMED', title: 'New', description: 'New text' },
  reason: null,
});

describe('understanding.repository', () => {
  let db: DbClient;
  beforeEach(() => {
    db = freshDb();
  });
  const m = (name: string) => prismaMock[name] as ReturnType<typeof model>;

  it('loads items only for the organization and project, hiding deleted requirements', async () => {
    m('requirement').findMany.mockResolvedValue([
      {
        id: 'r',
        title: 'R',
        description: 'd',
        status: 'OPEN',
        moduleId: 'm',
        sourceChunk: { content: 'x'.repeat(2000) },
      },
    ]);
    m('businessRule').findMany.mockResolvedValue([]);
    m('module').findMany.mockResolvedValue([
      {
        id: 'm',
        name: 'Billing',
        description: null,
        status: 'CONFIRMED',
        sourceChunk: { content: 'src' },
      },
    ]);

    const items = await loadItems(O, P, db);

    expect(m('requirement').findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: O,
      projectId: P,
      deletedAt: null,
    });
    expect(m('businessRule').findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: O,
      projectId: P,
    });
    expect(items.map((i) => [i.kind, i.id, i.moduleId])).toEqual([
      ['requirement', 'r', 'm'],
      ['module', 'm', 'm'],
    ]);
    expect(items[0]?.excerpt?.length).toBe(800);
    expect(items[1]).toMatchObject({ title: 'Billing', description: null });
  });

  it('reads question keys and open counts within the project', async () => {
    m('question').findMany.mockResolvedValue([{ dedupeKey: 'a' }, { dedupeKey: 'b' }]);
    m('question').count.mockResolvedValue(3);
    expect(await listQuestionKeys(O, P, db)).toEqual(new Set(['a', 'b']));
    expect(await countOpenQuestions(O, P, db)).toBe(3);
    expect(m('question').findMany.mock.calls[0]?.[0].where).toEqual({
      organizationId: O,
      projectId: P,
    });
    expect(m('question').count.mock.calls[0]?.[0].where).toEqual({
      organizationId: O,
      projectId: P,
      status: 'OPEN',
    });
  });

  it('inserts questions skipping existing keys and links only the ones actually created', async () => {
    m('question').createManyAndReturn.mockResolvedValue([{ id: 'q1', dedupeKey: 'k1' }]);
    const created = await insertQuestions(db, {
      organizationId: O,
      projectId: P,
      parentQuestionId: 'parent',
      questions: [
        {
          reason: 'GAP',
          priority: 'HIGH',
          text: 'One?',
          moduleId: null,
          dedupeKey: 'k1',
          linkedItems: [
            { kind: 'requirement', id: 'r1' },
            { kind: 'rule', id: 'u1' },
          ],
        },
        {
          reason: 'GAP',
          priority: 'NORMAL',
          text: 'Two?',
          moduleId: null,
          dedupeKey: 'k2',
          linkedItems: [{ kind: 'module', id: 'm1' }],
        },
      ],
    });

    expect(created).toBe(1);
    const args = m('question').createManyAndReturn.mock.calls[0]?.[0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data[0]).toMatchObject({
      content: 'One?',
      parentQuestionId: 'parent',
      createdById: null,
      organizationId: O,
      projectId: P,
    });
    expect(m('questionLink').createMany.mock.calls[0]?.[0].data).toEqual([
      { questionId: 'q1', organizationId: O, requirementId: 'r1', ruleId: null, moduleId: null },
      { questionId: 'q1', organizationId: O, requirementId: null, ruleId: 'u1', moduleId: null },
    ]);
  });

  it('does nothing for an empty list', async () => {
    expect(
      await insertQuestions(db, {
        organizationId: O,
        projectId: P,
        parentQuestionId: null,
        questions: [],
      }),
    ).toBe(0);
    expect(m('question').createManyAndReturn).not.toHaveBeenCalled();
  });

  it('numbers summaries one above the highest version of that project', async () => {
    m('projectSummary').aggregate.mockResolvedValue({ _max: { version: 4 } });
    m('projectSummary').create.mockResolvedValue({ id: 's' });
    const result = await createSummary(db, {
      organizationId: O,
      projectId: P,
      content: {
        overview: '',
        modules: [],
        keyRequirements: [],
        keyRules: [],
        assumptions: [],
        staleItems: [],
      },
      basedOn: { requirements: 1 },
      fingerprint: 'fp',
    });
    expect(result.version).toBe(5);
    expect(m('projectSummary').aggregate.mock.calls[0]?.[0].where).toEqual({
      organizationId: O,
      projectId: P,
    });
    expect(m('projectSummary').create.mock.calls[0]?.[0].data).toMatchObject({
      version: 5,
      fingerprint: 'fp',
    });
    m('projectSummary').aggregate.mockResolvedValue({ _max: { version: null } });
    expect(
      (
        await createSummary(db, {
          organizationId: O,
          projectId: P,
          content: {
            overview: '',
            modules: [],
            keyRequirements: [],
            keyRules: [],
            assumptions: [],
            staleItems: [],
          },
          basedOn: {},
          fingerprint: 'f2',
        })
      ).version,
    ).toBe(1);
  });

  it('returns the newest summary, and treats unreadable stored content as missing content', async () => {
    m('projectSummary').findFirst.mockResolvedValue({
      version: 2,
      fingerprint: 'fp',
      content: { nope: true },
    });
    expect(await latestSummary(O, P, db)).toEqual({ version: 2, fingerprint: 'fp', content: null });
    expect(m('projectSummary').findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { organizationId: O, projectId: P },
      orderBy: { version: 'desc' },
    });
    m('projectSummary').findFirst.mockResolvedValue(null);
    expect(await latestSummary(O, P, db)).toBeNull();
  });

  it('claims an answer only while it is unapplied, scoped to the project', async () => {
    m('answer').updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await claimAnswer(db, O, P, 'a1')).toBe(true);
    expect(await claimAnswer(db, O, P, 'a1')).toBe(false);
    expect(m('answer').updateMany.mock.calls[0]?.[0].where).toEqual({
      id: 'a1',
      organizationId: O,
      projectId: P,
      appliedAt: null,
    });
  });

  it.each([
    ['requirement', 'requirement', true],
    ['rule', 'businessRule', false],
    ['module', 'module', false],
  ] as const)(
    'never updates a confirmed %s, and scopes the write',
    async (kind, table, softDeleted) => {
      m(table).updateMany.mockResolvedValue({ count: 1 });
      expect(await updateItem(db, O, P, change(kind))).toBe(true);
      const call = m(table).updateMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: 'i1',
        organizationId: O,
        projectId: P,
        status: { not: 'CONFIRMED' },
      });
      expect('deletedAt' in call.where).toBe(softDeleted);
      expect(call.data).toMatchObject({ status: 'CONFIRMED' });
      expect(kind === 'module' ? call.data.name : call.data.title).toBe('New');

      m(table).updateMany.mockResolvedValue({ count: 0 });
      expect(await updateItem(db, O, P, change(kind))).toBe(false);
    },
  );

  it('finds the answer with its question and linked items inside the project', async () => {
    m('answer').findFirst.mockResolvedValue({
      id: 'a1',
      content: 'Five days',
      answeredById: 'u1',
      appliedAt: null,
      question: {
        id: 'q1',
        content: 'How long?',
        reason: 'GAP',
        priority: 'HIGH',
        moduleId: null,
        links: [
          { requirementId: 'r1', ruleId: null, moduleId: null },
          { requirementId: null, ruleId: 'u1', moduleId: null },
          { requirementId: null, ruleId: null, moduleId: 'm1' },
        ],
      },
    });
    const context = await findAnswerContext(O, P, 'a1', db);
    expect(context?.question.linked).toEqual([
      { kind: 'requirement', id: 'r1' },
      { kind: 'rule', id: 'u1' },
      { kind: 'module', id: 'm1' },
    ]);
    expect(m('answer').findFirst.mock.calls[0]?.[0].where).toEqual({
      id: 'a1',
      organizationId: O,
      projectId: P,
    });
    m('answer').findFirst.mockResolvedValue(null);
    expect(await findAnswerContext(O, P, 'nope', db)).toBeNull();
  });

  it('stores the decision as plain JSON with the author of the answer', async () => {
    m('decision').create.mockResolvedValue({ id: 'd1' });
    const id = await createDecision(db, {
      organizationId: O,
      projectId: P,
      answerId: 'a1',
      questionId: 'q1',
      decidedById: 'u1',
      summary: 'Decided.',
      changes: [change('rule')],
      conflicts: [],
    });
    expect(id).toBe('d1');
    expect(m('decision').create.mock.calls[0]?.[0].data).toMatchObject({
      answerId: 'a1',
      decidedById: 'u1',
      organizationId: O,
      projectId: P,
      conflicts: [],
    });
  });
});
