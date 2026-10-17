import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  question: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
  },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  claimForAnswer,
  claimForDismissal,
  countByStatus,
  countOpenByPriority,
  createAnswer,
  findConflictState,
  findQuestion,
  listQuestions,
} from './questions.repository.js';

const scope = { organizationId: 'o1', projectId: 'p1' };

describe('questions.repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.question.findMany.mockResolvedValue([]);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.question.groupBy.mockResolvedValue([]);
  });

  it('counts per module and priority over the same filters, not just the page that is shown', async () => {
    prismaMock.question.groupBy.mockResolvedValue([
      { moduleId: 'm1', priority: 'HIGH', _count: { _all: 2 } },
      { moduleId: null, priority: 'NORMAL', _count: { _all: 1 } },
    ]);
    const result = await listQuestions({ ...scope, status: 'OPEN', page: 3, pageSize: 5 });
    expect(result.moduleCounts).toEqual([
      { moduleId: 'm1', priority: 'HIGH', count: 2 },
      { moduleId: null, priority: 'NORMAL', count: 1 },
    ]);
    const args = prismaMock.question.groupBy.mock.calls[0]?.[0];
    expect(args.by).toEqual(['moduleId', 'priority']);
    expect(args.where).toEqual({ ...scope, status: 'OPEN' });
    expect(args).not.toHaveProperty('skip');
  });

  it('selects where each linked item was first found', async () => {
    await listQuestions({ ...scope, page: 1, pageSize: 5 });
    const links = prismaMock.question.findMany.mock.calls[0]?.[0].select.links.select;
    for (const key of ['requirement', 'rule', 'module']) {
      expect(links[key].select.sourceChunk.select).toHaveProperty('headingPath', true);
    }
  });

  it('scopes the list by organization and project and applies only the filters given', async () => {
    await listQuestions({ ...scope, page: 1, pageSize: 10 });
    expect(prismaMock.question.findMany.mock.calls[0]?.[0].where).toEqual(scope);

    await listQuestions({
      ...scope,
      status: 'OPEN',
      reason: 'GAP',
      priority: 'CRITICAL',
      moduleId: 'm1',
      page: 1,
      pageSize: 10,
    });
    expect(prismaMock.question.findMany.mock.calls[1]?.[0].where).toEqual({
      ...scope,
      status: 'OPEN',
      reason: 'GAP',
      priority: 'CRITICAL',
      moduleId: 'm1',
    });
    expect(prismaMock.question.count.mock.calls[1]?.[0].where).toEqual(
      prismaMock.question.findMany.mock.calls[1]?.[0].where,
    );
  });

  it('sorts by priority, then age, then id, and pages with skip and take', async () => {
    await listQuestions({ ...scope, page: 3, pageSize: 20 });
    expect(prismaMock.question.findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: 40,
      take: 20,
    });
  });

  it('selects the linked items and only the latest answer, never password or other user fields', async () => {
    await listQuestions({ ...scope, page: 1, pageSize: 10 });
    const select = prismaMock.question.findMany.mock.calls[0]?.[0].select;
    expect(select.answers).toMatchObject({ take: 1, orderBy: { createdAt: 'desc' } });
    expect(Object.keys(select.links.select).sort()).toEqual(['module', 'requirement', 'rule']);
    expect(JSON.stringify(select)).not.toMatch(/passwordHash|email/);
  });

  it('counts statuses for the project and open questions by priority', async () => {
    prismaMock.question.groupBy
      .mockResolvedValueOnce([{ status: 'OPEN', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ priority: 'CRITICAL', _count: { _all: 2 } }]);
    expect(await countByStatus('o1', 'p1')).toEqual([{ status: 'OPEN', count: 3 }]);
    expect(await countOpenByPriority('o1', 'p1')).toEqual([{ priority: 'CRITICAL', count: 2 }]);
    expect(prismaMock.question.groupBy.mock.calls[0]?.[0].where).toEqual(scope);
    expect(prismaMock.question.groupBy.mock.calls[1]?.[0].where).toEqual({
      ...scope,
      status: 'OPEN',
    });
  });

  it('finds one question only inside the organization and project', async () => {
    await findQuestion('o1', 'p1', 'q1');
    await findConflictState('o1', 'p1', 'q1', prismaMock as never);
    for (const call of [
      prismaMock.question.findFirst.mock.calls[0],
      prismaMock.question.findFirst.mock.calls[1],
    ]) {
      expect(call?.[0].where).toEqual({ id: 'q1', ...scope });
    }
  });

  it('claims an answer only while the question is open at the version the caller read', async () => {
    prismaMock.question.updateMany.mockResolvedValue({ count: 1 });
    expect(
      await claimForAnswer({ ...scope, questionId: 'q1', version: 4 }, prismaMock as never),
    ).toBe(true);
    expect(prismaMock.question.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'q1', ...scope, status: 'OPEN', version: 4 },
      data: { status: 'ANSWERED', version: { increment: 1 } },
    });

    prismaMock.question.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await claimForAnswer({ ...scope, questionId: 'q1', version: 4 }, prismaMock as never),
    ).toBe(false);
  });

  it('claims a dismissal with the same lock and records who, when and why', async () => {
    prismaMock.question.updateMany.mockResolvedValue({ count: 1 });
    const dismissedAt = new Date('2026-01-01T00:00:00Z');
    await claimForDismissal(
      {
        ...scope,
        questionId: 'q1',
        version: 2,
        reason: 'Out of scope',
        dismissedById: 'u1',
        dismissedAt,
      },
      prismaMock as never,
    );
    expect(prismaMock.question.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'q1', ...scope, status: 'OPEN', version: 2 },
      data: {
        status: 'DISMISSED',
        version: { increment: 1 },
        dismissReason: 'Out of scope',
        dismissedById: 'u1',
        dismissedAt,
      },
    });
  });

  it('writes an answer on the transaction client, scoped to the project', async () => {
    const tx = { answer: { create: vi.fn().mockResolvedValue({ id: 'a1' }) } };
    const data = {
      content: 'x',
      questionId: 'q1',
      answeredById: 'u1',
      projectId: 'p1',
      organizationId: 'o1',
    };
    expect(await createAnswer(data, tx as never)).toEqual({ id: 'a1' });
    expect(tx.answer.create.mock.calls[0]?.[0].data).toEqual(data);
  });
});
