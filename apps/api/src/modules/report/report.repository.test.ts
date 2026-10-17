import { describe, it, expect, vi, beforeEach } from 'vitest';

const model = () => ({
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
  aggregate: vi.fn().mockResolvedValue({ _max: { version: null } }),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  upsert: vi.fn().mockResolvedValue({ id: 'report-1' }),
  create: vi.fn().mockResolvedValue({ id: 'new-1', version: 1 }),
});
const prismaMock = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof model>>);
vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import {
  completeGeneration,
  createVersion,
  failGeneration,
  findBlockingQuestions,
  findCondition,
  findVersion,
  listOwnerIds,
  loadItems,
  loadOpenQuestions,
  markOutdated,
  recordDecision,
  submitVersion,
} from './report.repository.js';
import type { DbClient } from '../../lib/transaction.js';

const scope = { organizationId: 'o1', projectId: 'p1' };

type Mocks = Record<string, ReturnType<typeof model>>;

/** A transaction client made of mocks, and the same mocks typed for assertions. */
function tx(): { db: DbClient; m: Mocks } {
  const m: Mocks = Object.fromEntries(
    ['report', 'reportVersion', 'approval', 'approvalCondition'].map((n) => [n, model()]),
  );
  return { db: m as unknown as DbClient, m };
}

describe('report.repository', () => {
  beforeEach(() => {
    for (const name of [
      'requirement',
      'businessRule',
      'module',
      'question',
      'projectMember',
      'reportVersion',
      'approvalCondition',
      'project',
    ]) {
      prismaMock[name] = model();
    }
  });

  it('reads items, questions and owners only inside the project', async () => {
    await loadItems('o1', 'p1');
    await loadOpenQuestions('o1', 'p1');
    await findBlockingQuestions('o1', 'p1');
    await listOwnerIds('o1', 'p1');
    for (const name of ['requirement', 'businessRule', 'module']) {
      expect(prismaMock[name]?.findMany.mock.calls[0]?.[0].where).toMatchObject(scope);
    }
    expect(prismaMock['requirement']?.findMany.mock.calls[0]?.[0].where.deletedAt).toBeNull();
    expect(prismaMock['question']?.count.mock.calls[0]?.[0].where).toEqual({
      ...scope,
      status: 'OPEN',
    });
    expect(prismaMock['question']?.findMany.mock.calls[1]?.[0].where).toEqual({
      ...scope,
      status: 'OPEN',
      priority: 'CRITICAL',
    });
    expect(prismaMock['projectMember']?.findMany.mock.calls[0]?.[0].where).toEqual({
      ...scope,
      role: 'OWNER',
    });
  });

  it('looks a version up by number inside the project', async () => {
    await findVersion('o1', 'p1', 4);
    expect(prismaMock['reportVersion']?.findFirst.mock.calls[0]?.[0].where).toEqual({
      ...scope,
      version: 4,
    });
  });

  it('finds a condition only through its own project and version', async () => {
    await findCondition('o1', 'p1', 2, 'c1');
    expect(prismaMock['approvalCondition']?.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      id: 'c1',
      organizationId: 'o1',
      approval: { projectId: 'p1', organizationId: 'o1', reportVersion: { version: 2 } },
    });
  });

  it('numbers a new version after the last one, under the project’s single report', async () => {
    const { db, m } = tx();
    m['reportVersion']?.aggregate.mockResolvedValue({ _max: { version: 4 } });
    await createVersion(db, { ...scope, userId: 'u1' });
    expect(m['report']?.upsert.mock.calls[0]?.[0].where).toEqual({
      projectId_type: { projectId: 'p1', type: 'UNDERSTANDING' },
    });
    expect(m['reportVersion']?.create.mock.calls[0]?.[0].data).toMatchObject({
      version: 5,
      status: 'GENERATING',
      ...scope,
      createdById: 'u1',
    });
  });

  it.each([
    [
      'writes content only while GENERATING',
      (db: DbClient) =>
        completeGeneration(db, {
          ...scope,
          id: 'v1',
          content: {},
          summaryVersion: 1,
          itemsFingerprint: 'f',
        }),
      'GENERATING',
    ],
    [
      'submits only a DRAFT',
      (db: DbClient) => submitVersion(db, { ...scope, id: 'v1', userId: 'u1' }),
      'DRAFT',
    ],
  ])('%s', async (_name, call, status) => {
    const { db, m } = tx();
    expect(await call(db)).toBe(true);
    expect(m['reportVersion']?.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      id: 'v1',
      ...scope,
      status,
    });
  });

  it('fails a version only while it is GENERATING', async () => {
    await failGeneration('o1', 'p1', 'v1', 'why');
    expect(prismaMock['reportVersion']?.updateMany.mock.calls[0]?.[0].where).toMatchObject({
      id: 'v1',
      ...scope,
      status: 'GENERATING',
    });
  });

  it('marks only approved versions outdated', async () => {
    const { db, m } = tx();
    await markOutdated(db, 'o1', 'p1', 'v1');
    expect(m['reportVersion']?.updateMany.mock.calls[0]?.[0].where.status).toEqual({
      in: ['APPROVED', 'APPROVED_WITH_CONDITIONS'],
    });
  });

  describe('recordDecision', () => {
    const decision = {
      ...scope,
      versionId: 'v1',
      decision: 'APPROVED_WITH_CONDITIONS' as const,
      comment: 'ok',
      decidedById: 'u2',
      baseline: { snapshot: { items: [] }, hash: 'h', fingerprint: 'f' },
      conditions: ['one', 'two'],
    };

    it('moves a SUBMITTED version and stores the approval with its baseline and conditions', async () => {
      const { db, m } = tx();
      m['approval']?.create.mockResolvedValue({ id: 'a1' });
      expect(await recordDecision(db, decision)).toBe('a1');
      expect(m['reportVersion']?.updateMany.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'v1', ...scope, status: 'SUBMITTED' },
        data: { status: 'APPROVED_WITH_CONDITIONS' },
      });
      const data = m['approval']?.create.mock.calls[0]?.[0].data;
      expect(data).toMatchObject({
        reportVersionId: 'v1',
        baselineHash: 'h',
        baselineFingerprint: 'f',
        decidedById: 'u2',
        ...scope,
      });
      const created = data.conditions.create as {
        text: string;
        organizationId: string;
        createdAt: Date;
      }[];
      expect(created.map((c) => [c.text, c.organizationId])).toEqual([
        ['one', 'o1'],
        ['two', 'o1'],
      ]);
      // Each condition gets its own, increasing timestamp so they read back in the order entered.
      const [first, second] = created;
      expect(second?.createdAt.getTime() ?? 0).toBeGreaterThan(first?.createdAt.getTime() ?? 0);
    });

    it('stores nothing when the version was already decided', async () => {
      const { db, m } = tx();
      m['reportVersion']?.updateMany.mockResolvedValue({ count: 0 });
      expect(await recordDecision(db, decision)).toBeNull();
      expect(m['approval']?.create).not.toHaveBeenCalled();
    });

    it('has no way to change or delete an approval', async () => {
      const repo = await import('./report.repository.js');
      expect(
        Object.keys(repo).filter((k) => /approval/i.test(k) && /update|delete|edit/i.test(k)),
      ).toEqual([]);
    });
  });
});
