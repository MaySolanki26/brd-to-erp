import type { Prisma } from '@prisma/client';
import {
  summaryLlmOutputSchema,
  APPROVED_STATUSES,
  type ApprovalDecision,
  type BlockingQuestionDto,
  type ConditionStatus,
  type ReportVersionStatus,
} from '@brd/shared';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import { MAX_REPORT_QUESTIONS } from './report.content.js';
import type { OpenQuestion, ReportItem, SourceVersions, StoredSummary } from './report.types.js';

const ITEM_LIMIT = 5000;
const VERSION_LIMIT = 100;
const BLOCKING_LIMIT = 100;
const ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const;
const person = { select: { id: true, name: true } } as const;

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

/** Every live requirement, rule and module of the project. */
export async function loadItems(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<ReportItem[]> {
  const where = { organizationId, projectId };
  const itemSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    moduleId: true,
    sourceChunkId: true,
    module: { select: { name: true } },
  } as const;
  const [requirements, rules, modules] = await Promise.all([
    db.requirement.findMany({
      where: { ...where, deletedAt: null },
      select: itemSelect,
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
    db.businessRule.findMany({
      where,
      select: itemSelect,
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
    db.module.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        status: true,
        sourceChunkId: true,
      },
      orderBy: [...ORDER],
      take: ITEM_LIMIT,
    }),
  ]);
  const fromRow =
    (kind: 'requirement' | 'rule') =>
    (r: (typeof requirements)[number]): ReportItem => ({
      kind,
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      moduleId: r.moduleId,
      moduleName: r.module?.name ?? null,
      sourceChunkId: r.sourceChunkId,
      code: null,
    });
  return [
    ...modules.map((m): ReportItem => ({
      kind: 'module',
      id: m.id,
      title: m.name,
      description: m.description,
      status: m.status,
      moduleId: null,
      moduleName: null,
      sourceChunkId: m.sourceChunkId,
      code: m.code,
    })),
    ...requirements.map(fromRow('requirement')),
    ...rules.map(fromRow('rule')),
  ];
}

export async function latestSummary(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<StoredSummary | null> {
  const row = await db.projectSummary.findFirst({
    where: { organizationId, projectId },
    select: { version: true, content: true },
    orderBy: { version: 'desc' },
  });
  if (!row) return null;
  const parsed = summaryLlmOutputSchema.safeParse(row.content);
  return parsed.success ? { version: row.version, content: parsed.data } : null;
}

const openQuestionWhere = (organizationId: string, projectId: string) =>
  ({ organizationId, projectId, status: 'OPEN' }) as const;

/** The open CRITICAL questions that stop a report, most recent last. */
export async function findBlockingQuestions(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<BlockingQuestionDto[]> {
  const rows = await db.question.findMany({
    where: { ...openQuestionWhere(organizationId, projectId), priority: 'CRITICAL' },
    select: { id: true, content: true, priority: true, reason: true },
    orderBy: [...ORDER],
    take: BLOCKING_LIMIT,
  });
  return rows.map((q) => ({ id: q.id, text: q.content, priority: q.priority, reason: q.reason }));
}

/** All open questions: the total, and the most urgent ones up to the report's limit. */
export async function loadOpenQuestions(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<{ total: number; items: OpenQuestion[] }> {
  const where = openQuestionWhere(organizationId, projectId);
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      select: {
        id: true,
        content: true,
        priority: true,
        reason: true,
        module: { select: { name: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: MAX_REPORT_QUESTIONS,
    }),
  ]);
  return {
    total,
    items: rows.map((q) => ({
      id: q.id,
      priority: q.priority,
      reason: q.reason,
      text: q.content,
      moduleName: q.module?.name ?? null,
    })),
  };
}

/** The latest version of every live document, and every note, as they are now. */
export async function loadSourceVersions(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<SourceVersions> {
  const where = { organizationId, projectId };
  const [documents, notes] = await Promise.all([
    db.document.findMany({
      where: { ...where, deletedAt: null },
      select: {
        id: true,
        versions: {
          select: { id: true, versionNumber: true, contentHash: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: [...ORDER],
    }),
    db.contextNote.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: [...ORDER],
    }),
  ]);
  return {
    documents: documents.flatMap((d) =>
      d.versions.map((v) => ({
        id: d.id,
        versionId: v.id,
        versionNumber: v.versionNumber,
        contentHash: v.contentHash,
      })),
    ),
    notes: notes.map((n) => ({ id: n.id, updatedAt: n.updatedAt.toISOString() })),
  };
}

/** Ids of the project's OWNER members. */
export async function listOwnerIds(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<string[]> {
  const rows = await db.projectMember.findMany({
    where: { organizationId, projectId, role: 'OWNER' },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Serialises writers of one project's report versions. */
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

export interface NewVersion {
  id: string;
  version: number;
}

/** Starts the next version in GENERATING; call under `lockProject` so numbers never collide. */
export async function createVersion(
  db: DbClient,
  params: { organizationId: string; projectId: string; userId: string },
): Promise<NewVersion> {
  const { organizationId, projectId, userId } = params;
  const report = await db.report.upsert({
    where: { projectId_type: { projectId, type: 'UNDERSTANDING' } },
    create: { projectId, organizationId, type: 'UNDERSTANDING' },
    update: {},
    select: { id: true },
  });
  const last = await db.reportVersion.aggregate({
    where: { reportId: report.id },
    _max: { version: true },
  });
  return db.reportVersion.create({
    data: {
      reportId: report.id,
      version: (last._max.version ?? 0) + 1,
      status: 'GENERATING',
      projectId,
      organizationId,
      createdById: userId,
    },
    select: { id: true, version: true },
  });
}

export async function latestVersionNumber(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<number | null> {
  const row = await db.reportVersion.aggregate({
    where: { organizationId, projectId },
    _max: { version: true },
  });
  return row._max.version;
}

export interface JobVersion {
  id: string;
  status: ReportVersionStatus;
}

export async function findVersionById(
  organizationId: string,
  projectId: string,
  id: string,
): Promise<JobVersion | null> {
  return prisma.reportVersion.findFirst({
    where: { id, organizationId, projectId },
    select: { id: true, status: true },
  });
}

/** Stores the finished report once: only a version still GENERATING is written. */
export async function completeGeneration(
  db: DbClient,
  params: {
    organizationId: string;
    projectId: string;
    id: string;
    content: unknown;
    summaryVersion: number;
    itemsFingerprint: string;
  },
): Promise<boolean> {
  const { organizationId, projectId, id } = params;
  const result = await db.reportVersion.updateMany({
    where: { id, organizationId, projectId, status: 'GENERATING' },
    data: {
      status: 'DRAFT',
      content: toJson(params.content),
      summaryVersion: params.summaryVersion,
      itemsFingerprint: params.itemsFingerprint,
      failureReason: null,
    },
  });
  return result.count === 1;
}

export async function failGeneration(
  organizationId: string,
  projectId: string,
  id: string,
  reason: string,
): Promise<boolean> {
  const result = await prisma.reportVersion.updateMany({
    where: { id, organizationId, projectId, status: 'GENERATING' },
    data: { status: 'FAILED', failureReason: reason },
  });
  return result.count === 1;
}

const versionSelect = {
  id: true,
  version: true,
  status: true,
  summaryVersion: true,
  itemsFingerprint: true,
  failureReason: true,
  createdAt: true,
  submittedAt: true,
  outdatedAt: true,
  createdBy: person,
  submittedBy: person,
  approval: {
    select: {
      decision: true,
      comment: true,
      decidedAt: true,
      baselineHash: true,
      baselineFingerprint: true,
      decidedBy: person,
      conditions: {
        select: {
          id: true,
          text: true,
          status: true,
          metAt: true,
          updatedBy: person,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  },
} satisfies Prisma.ReportVersionSelect;

export type VersionRecord = Prisma.ReportVersionGetPayload<{ select: typeof versionSelect }> & {
  content?: unknown;
};

export async function listVersions(
  organizationId: string,
  projectId: string,
): Promise<VersionRecord[]> {
  return prisma.reportVersion.findMany({
    where: { organizationId, projectId },
    select: versionSelect,
    orderBy: { version: 'desc' },
    take: VERSION_LIMIT,
  });
}

export async function findVersion(
  organizationId: string,
  projectId: string,
  version: number,
): Promise<VersionRecord | null> {
  return prisma.reportVersion.findFirst({
    where: { organizationId, projectId, version },
    select: { ...versionSelect, content: true },
  });
}

/** DRAFT to SUBMITTED. False when the version is no longer a draft. */
export async function submitVersion(
  db: DbClient,
  params: { organizationId: string; projectId: string; id: string; userId: string },
): Promise<boolean> {
  const { organizationId, projectId, id, userId } = params;
  const result = await db.reportVersion.updateMany({
    where: { id, organizationId, projectId, status: 'DRAFT' },
    data: { status: 'SUBMITTED', submittedById: userId, submittedAt: new Date() },
  });
  return result.count === 1;
}

export interface NewDecision {
  organizationId: string;
  projectId: string;
  versionId: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedById: string;
  baseline: { snapshot: unknown; hash: string; fingerprint: string };
  conditions: string[];
}

/**
 * Moves a SUBMITTED version to its decided status and stores the approval with its baseline.
 * Returns the approval id, or null when the version was already decided.
 */
export async function recordDecision(db: DbClient, params: NewDecision): Promise<string | null> {
  const { organizationId, projectId, versionId } = params;
  const moved = await db.reportVersion.updateMany({
    where: { id: versionId, organizationId, projectId, status: 'SUBMITTED' },
    data: { status: params.decision },
  });
  if (moved.count !== 1) return null;
  const approval = await db.approval.create({
    data: {
      reportVersionId: versionId,
      decision: params.decision,
      comment: params.comment,
      baselineSnapshot: toJson(params.baseline.snapshot),
      baselineHash: params.baseline.hash,
      baselineFingerprint: params.baseline.fingerprint,
      projectId,
      organizationId,
      decidedById: params.decidedById,
      conditions: {
        // Rows saved together share one database timestamp, so give each its own to keep the order.
        create: params.conditions.map((text, index) => ({
          text,
          organizationId,
          createdAt: new Date(Date.now() + index),
        })),
      },
    },
    select: { id: true },
  });
  return approval.id;
}

export interface ApprovedBaseline {
  versionId: string;
  version: number;
  baselineFingerprint: string;
}

/** Approved versions that still count, with the items fingerprint they were approved against. */
export async function findApprovedBaselines(
  organizationId: string,
  projectId: string,
  db: DbClient = prisma,
): Promise<ApprovedBaseline[]> {
  const rows = await db.reportVersion.findMany({
    where: { organizationId, projectId, status: { in: [...APPROVED_STATUSES] } },
    select: { id: true, version: true, approval: { select: { baselineFingerprint: true } } },
  });
  return rows.flatMap((r) =>
    r.approval
      ? [
          {
            versionId: r.id,
            version: r.version,
            baselineFingerprint: r.approval.baselineFingerprint,
          },
        ]
      : [],
  );
}

/** APPROVED or APPROVED_WITH_CONDITIONS to OUTDATED. False when it was not approved any more. */
export async function markOutdated(
  db: DbClient,
  organizationId: string,
  projectId: string,
  versionId: string,
): Promise<boolean> {
  const result = await db.reportVersion.updateMany({
    where: { id: versionId, organizationId, projectId, status: { in: [...APPROVED_STATUSES] } },
    data: { status: 'OUTDATED', outdatedAt: new Date() },
  });
  return result.count === 1;
}

export interface ConditionRecord {
  id: string;
  text: string;
  status: ConditionStatus;
  versionStatus: ReportVersionStatus;
}

export async function findCondition(
  organizationId: string,
  projectId: string,
  version: number,
  conditionId: string,
): Promise<ConditionRecord | null> {
  const row = await prisma.approvalCondition.findFirst({
    where: {
      id: conditionId,
      organizationId,
      approval: { projectId, organizationId, reportVersion: { version } },
    },
    select: {
      id: true,
      text: true,
      status: true,
      approval: { select: { reportVersion: { select: { status: true } } } },
    },
  });
  return row
    ? {
        id: row.id,
        text: row.text,
        status: row.status,
        versionStatus: row.approval.reportVersion.status,
      }
    : null;
}

export async function updateCondition(
  db: DbClient,
  params: {
    organizationId: string;
    id: string;
    userId: string;
    text?: string | undefined;
    status?: ConditionStatus | undefined;
  },
): Promise<void> {
  await db.approvalCondition.updateMany({
    where: { id: params.id, organizationId: params.organizationId },
    data: {
      updatedById: params.userId,
      ...(params.text !== undefined && { text: params.text }),
      ...(params.status !== undefined && {
        status: params.status,
        metAt: params.status === 'MET' ? new Date() : null,
      }),
    },
  });
}

export type ReportRepository = {
  projectName: typeof projectName;
  loadItems: typeof loadItems;
  latestSummary: typeof latestSummary;
  findBlockingQuestions: typeof findBlockingQuestions;
  loadOpenQuestions: typeof loadOpenQuestions;
  loadSourceVersions: typeof loadSourceVersions;
  listOwnerIds: typeof listOwnerIds;
  lockProject: typeof lockProject;
  createVersion: typeof createVersion;
  latestVersionNumber: typeof latestVersionNumber;
  findVersionById: typeof findVersionById;
  completeGeneration: typeof completeGeneration;
  failGeneration: typeof failGeneration;
  listVersions: typeof listVersions;
  findVersion: typeof findVersion;
  submitVersion: typeof submitVersion;
  recordDecision: typeof recordDecision;
  findApprovedBaselines: typeof findApprovedBaselines;
  markOutdated: typeof markOutdated;
  findCondition: typeof findCondition;
  updateCondition: typeof updateCondition;
};
