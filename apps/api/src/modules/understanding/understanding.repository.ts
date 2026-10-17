import type { Prisma } from '@prisma/client';
import { summaryLlmOutputSchema, type SummaryLlmOutput } from '@brd/shared';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import type { PlannedQuestion } from './plan-questions.js';
import type { PlannedChange } from './plan-answer.js';
import {
  EXCERPT_CHARS,
  type AnswerContext,
  type ExistingQuestion,
  type ItemRef,
  type PromptItem,
} from './understanding.types.js';

const ITEM_LIMIT = 2000;
const chunk = { select: { content: true } } as const;
const ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const;

const excerpt = (content: string): string => content.slice(0, EXCERPT_CHARS);

/** Prisma wants JSON-typed input; this makes sure only plain JSON values go in. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function projectName(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
    select: { name: true },
  });
  return project?.name ?? null;
}

/** Every live requirement, rule and module of the project, with the text each was taken from. */
export async function loadItems(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<PromptItem[]> {
  const where = { organizationId, projectId };
  const [requirements, rules, modules] = await Promise.all([
    db.requirement.findMany({
      where: { ...where, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        moduleId: true,
        sourceChunk: chunk,
      },
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
    db.businessRule.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        moduleId: true,
        sourceChunk: chunk,
      },
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
    db.module.findMany({
      where,
      select: { id: true, name: true, description: true, status: true, sourceChunk: chunk },
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
  ]);
  return [
    ...requirements.map((r) => ({
      kind: 'requirement' as const,
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      moduleId: r.moduleId,
      excerpt: excerpt(r.sourceChunk.content),
    })),
    ...rules.map((r) => ({
      kind: 'rule' as const,
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      moduleId: r.moduleId,
      excerpt: excerpt(r.sourceChunk.content),
    })),
    ...modules.map((m) => ({
      kind: 'module' as const,
      id: m.id,
      title: m.name,
      description: m.description,
      status: m.status,
      moduleId: m.id,
      excerpt: excerpt(m.sourceChunk.content),
    })),
  ];
}

export async function listQuestionKeys(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<Set<string>> {
  const rows = await db.question.findMany({
    where: { organizationId, projectId },
    select: { dedupeKey: true },
  });
  return new Set(rows.map((r) => r.dedupeKey));
}

export async function listQuestionsForPrompt(
  organizationId: string,
  projectId: string,
  limit: number,
  db: DbClient = prisma,
): Promise<ExistingQuestion[]> {
  const rows = await db.question.findMany({
    where: { organizationId, projectId },
    select: {
      id: true,
      status: true,
      reason: true,
      content: true,
      links: { select: { requirementId: true, ruleId: true, moduleId: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: limit,
  });
  return rows.map((q) => ({
    id: q.id,
    status: q.status,
    reason: q.reason,
    text: q.content,
    linked: q.links.flatMap(linkRefs),
  }));
}

function linkRefs(link: {
  requirementId: string | null;
  ruleId: string | null;
  moduleId: string | null;
}): ItemRef[] {
  if (link.requirementId) return [{ kind: 'requirement', id: link.requirementId }];
  if (link.ruleId) return [{ kind: 'rule', id: link.ruleId }];
  if (link.moduleId) return [{ kind: 'module', id: link.moduleId }];
  return [];
}

export async function countOpenQuestions(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.question.count({ where: { organizationId, projectId, status: 'OPEN' } });
}

/**
 * Stores questions the project has not asked yet. A key that already exists (a retry, or a second
 * worker) is skipped by the database itself. Returns how many were created.
 */
export async function insertQuestions(
  db: DbClient,
  params: {
    organizationId: string;
    projectId: string;
    parentQuestionId: string | null;
    questions: PlannedQuestion[];
  },
): Promise<number> {
  if (params.questions.length === 0) return 0;
  const created = await db.question.createManyAndReturn({
    data: params.questions.map((q) => ({
      content: q.text,
      reason: q.reason,
      priority: q.priority,
      dedupeKey: q.dedupeKey,
      moduleId: q.moduleId,
      parentQuestionId: params.parentQuestionId,
      createdById: null,
      projectId: params.projectId,
      organizationId: params.organizationId,
    })),
    skipDuplicates: true,
    select: { id: true, dedupeKey: true },
  });

  const byKey = new Map(params.questions.map((q) => [q.dedupeKey, q]));
  const links = created.flatMap((row) =>
    (byKey.get(row.dedupeKey)?.linkedItems ?? []).map((ref) => ({
      questionId: row.id,
      organizationId: params.organizationId,
      requirementId: ref.kind === 'requirement' ? ref.id : null,
      ruleId: ref.kind === 'rule' ? ref.id : null,
      moduleId: ref.kind === 'module' ? ref.id : null,
    })),
  );
  if (links.length > 0) {
    await db.questionLink.createMany({ data: links, skipDuplicates: true });
  }
  return created.length;
}

export interface StoredSummary {
  version: number;
  fingerprint: string;
  content: SummaryLlmOutput | null;
}

export async function latestSummary(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<StoredSummary | null> {
  const row = await db.projectSummary.findFirst({
    where: { organizationId, projectId },
    orderBy: { version: 'desc' },
    select: { version: true, fingerprint: true, content: true },
  });
  if (!row) return null;
  const parsed = summaryLlmOutputSchema.safeParse(row.content);
  return {
    version: row.version,
    fingerprint: row.fingerprint,
    content: parsed.success ? parsed.data : null,
  };
}

/** Serializes writers on one project so two summaries never race for the same version number. */
export async function lockProject(
  db: DbClient,
  organizationId: string,
  projectId: string,
): Promise<void> {
  await db.project.updateMany({
    where: { id: projectId, organizationId },
    data: { updatedAt: new Date() },
  });
}

export async function createSummary(
  db: DbClient,
  params: {
    organizationId: string;
    projectId: string;
    content: SummaryLlmOutput;
    basedOn: Record<string, number>;
    fingerprint: string;
  },
): Promise<{ id: string; version: number }> {
  const latest = await db.projectSummary.aggregate({
    where: { organizationId: params.organizationId, projectId: params.projectId },
    _max: { version: true },
  });
  const version = (latest._max.version ?? 0) + 1;
  const row = await db.projectSummary.create({
    data: {
      organizationId: params.organizationId,
      projectId: params.projectId,
      version,
      content: toJson(params.content),
      basedOn: toJson(params.basedOn),
      fingerprint: params.fingerprint,
    },
    select: { id: true },
  });
  return { id: row.id, version };
}

export async function findAnswerContext(
  organizationId: string,
  projectId: string,
  answerId: string,
  db: DbClient = prisma,
): Promise<AnswerContext | null> {
  const answer = await db.answer.findFirst({
    where: { id: answerId, organizationId, projectId },
    select: {
      id: true,
      content: true,
      answeredById: true,
      appliedAt: true,
      question: {
        select: {
          id: true,
          content: true,
          reason: true,
          priority: true,
          moduleId: true,
          links: { select: { requirementId: true, ruleId: true, moduleId: true } },
        },
      },
    },
  });
  if (!answer) return null;
  return {
    answerId: answer.id,
    text: answer.content,
    answeredById: answer.answeredById,
    appliedAt: answer.appliedAt,
    question: {
      id: answer.question.id,
      text: answer.question.content,
      reason: answer.question.reason,
      priority: answer.question.priority,
      moduleId: answer.question.moduleId,
      linked: answer.question.links.flatMap(linkRefs),
    },
  };
}

/** Marks the answer applied. False means another run already did, so this one must stop. */
export async function claimAnswer(
  db: DbClient,
  organizationId: string,
  projectId: string,
  answerId: string,
): Promise<boolean> {
  const result = await db.answer.updateMany({
    where: { id: answerId, organizationId, projectId, appliedAt: null },
    data: { appliedAt: new Date() },
  });
  return result.count === 1;
}

/**
 * Writes one change, but never to an item that is CONFIRMED at this moment. False means the item was
 * confirmed (or removed) after the answer was read, and the change was not made.
 */
export async function updateItem(
  db: DbClient,
  organizationId: string,
  projectId: string,
  change: PlannedChange,
): Promise<boolean> {
  const where = { id: change.id, organizationId, projectId, status: { not: 'CONFIRMED' as const } };
  const { status, title, description } = change.after;
  if (change.kind === 'requirement') {
    const result = await db.requirement.updateMany({
      where: { ...where, deletedAt: null },
      data: { status, title, description: description ?? '' },
    });
    return result.count === 1;
  }
  if (change.kind === 'rule') {
    const result = await db.businessRule.updateMany({
      where,
      data: { status, title, description: description ?? '' },
    });
    return result.count === 1;
  }
  const result = await db.module.updateMany({ where, data: { status, name: title, description } });
  return result.count === 1;
}

export async function createDecision(
  db: DbClient,
  params: {
    organizationId: string;
    projectId: string;
    answerId: string;
    questionId: string;
    decidedById: string;
    summary: string;
    changes: unknown[];
    conflicts: unknown[];
  },
): Promise<string> {
  const row = await db.decision.create({
    data: {
      answerId: params.answerId,
      questionId: params.questionId,
      decidedById: params.decidedById,
      projectId: params.projectId,
      organizationId: params.organizationId,
      summary: params.summary,
      changes: toJson(params.changes),
      conflicts: toJson(params.conflicts),
    },
    select: { id: true },
  });
  return row.id;
}

export type UnderstandingRepository = {
  projectName: typeof projectName;
  loadItems: typeof loadItems;
  listQuestionKeys: typeof listQuestionKeys;
  listQuestionsForPrompt: typeof listQuestionsForPrompt;
  countOpenQuestions: typeof countOpenQuestions;
  insertQuestions: typeof insertQuestions;
  latestSummary: typeof latestSummary;
  lockProject: typeof lockProject;
  createSummary: typeof createSummary;
  findAnswerContext: typeof findAnswerContext;
  claimAnswer: typeof claimAnswer;
  updateItem: typeof updateItem;
  createDecision: typeof createDecision;
};
