import type { Prisma, QuestionPriority, QuestionReason, QuestionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

const personSelect = { id: true, name: true } as const;

const questionSelect = {
  id: true,
  content: true,
  status: true,
  reason: true,
  priority: true,
  version: true,
  dismissReason: true,
  dismissedAt: true,
  parentQuestionId: true,
  createdAt: true,
  updatedAt: true,
  module: { select: { id: true, name: true } },
  links: {
    select: {
      requirement: { select: { id: true, title: true, status: true } },
      rule: { select: { id: true, title: true, status: true } },
      module: { select: { id: true, name: true, status: true } },
    },
  },
  answers: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      appliedAt: true,
      answeredBy: { select: personSelect },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const;

export type QuestionRecord = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

export interface QuestionFilter {
  organizationId: string;
  projectId: string;
  status?: QuestionStatus | undefined;
  reason?: QuestionReason | undefined;
  priority?: QuestionPriority | undefined;
  moduleId?: string | undefined;
}

function whereOf(filter: QuestionFilter): Prisma.QuestionWhereInput {
  return {
    organizationId: filter.organizationId,
    projectId: filter.projectId,
    ...(filter.status && { status: filter.status }),
    ...(filter.reason && { reason: filter.reason }),
    ...(filter.priority && { priority: filter.priority }),
    ...(filter.moduleId && { moduleId: filter.moduleId }),
  };
}

/** Most urgent first (the enum is declared CRITICAL, HIGH, NORMAL), oldest first within a priority. */
export async function listQuestions(
  filter: QuestionFilter & { page: number; pageSize: number },
): Promise<{ items: QuestionRecord[]; total: number }> {
  const where = whereOf(filter);
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      select: questionSelect,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.question.count({ where }),
  ]);
  return { items, total };
}

export async function countByStatus(
  organizationId: string,
  projectId: string,
): Promise<{ status: QuestionStatus; count: number }[]> {
  const groups = await prisma.question.groupBy({
    by: ['status'],
    where: { organizationId, projectId },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function countOpenByPriority(
  organizationId: string,
  projectId: string,
): Promise<{ priority: QuestionPriority; count: number }[]> {
  const groups = await prisma.question.groupBy({
    by: ['priority'],
    where: { organizationId, projectId, status: 'OPEN' },
    _count: { _all: true },
  });
  return groups.map((g) => ({ priority: g.priority, count: g._count._all }));
}

export async function findQuestion(
  organizationId: string,
  projectId: string,
  questionId: string,
  db: DbClient = prisma,
): Promise<QuestionRecord | null> {
  return db.question.findFirst({
    where: { id: questionId, organizationId, projectId },
    select: questionSelect,
  });
}

export interface ConflictState {
  status: QuestionStatus;
  version: number;
  dismissedBy: { name: string } | null;
  answers: { answeredBy: { name: string } }[];
}

/** What a lost race needs to explain itself: who got there first. */
export async function findConflictState(
  organizationId: string,
  projectId: string,
  questionId: string,
  db: DbClient,
): Promise<ConflictState | null> {
  return db.question.findFirst({
    where: { id: questionId, organizationId, projectId },
    select: {
      status: true,
      version: true,
      dismissedBy: { select: { name: true } },
      answers: {
        select: { answeredBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

interface Claim {
  organizationId: string;
  projectId: string;
  questionId: string;
  /** The version the caller read. The update only matches while the question is still OPEN at it. */
  version: number;
}

/** Optimistic lock: true only for the caller that still sees the current version. */
export async function claimForAnswer(claim: Claim, db: DbClient): Promise<boolean> {
  const result = await db.question.updateMany({
    where: {
      id: claim.questionId,
      organizationId: claim.organizationId,
      projectId: claim.projectId,
      status: 'OPEN',
      version: claim.version,
    },
    data: { status: 'ANSWERED', version: { increment: 1 } },
  });
  return result.count === 1;
}

export async function claimForDismissal(
  claim: Claim & { reason: string; dismissedById: string; dismissedAt: Date },
  db: DbClient,
): Promise<boolean> {
  const result = await db.question.updateMany({
    where: {
      id: claim.questionId,
      organizationId: claim.organizationId,
      projectId: claim.projectId,
      status: 'OPEN',
      version: claim.version,
    },
    data: {
      status: 'DISMISSED',
      version: { increment: 1 },
      dismissReason: claim.reason,
      dismissedById: claim.dismissedById,
      dismissedAt: claim.dismissedAt,
    },
  });
  return result.count === 1;
}

export async function createAnswer(
  data: {
    content: string;
    questionId: string;
    answeredById: string;
    projectId: string;
    organizationId: string;
  },
  db: DbClient,
): Promise<{ id: string }> {
  return db.answer.create({ data, select: { id: true } });
}
