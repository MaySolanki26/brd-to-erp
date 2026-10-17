import { randomUUID } from 'node:crypto';
import {
  APPROVED_STATUSES,
  summaryLlmOutputSchema,
  type ApprovalDecision,
  type ReportVersionStatus,
} from '@brd/shared';
import type { ReportItem } from '../modules/report/report.types.js';
import type { ReportRepository, VersionRecord } from '../modules/report/report.repository.js';
import { MAX_REPORT_QUESTIONS } from '../modules/report/report.content.js';
import { db, type FakeKnowledge } from './fake-db.js';
import { qdb } from './fake-questions.js';

export interface FakeCondition {
  id: string;
  text: string;
  status: 'OPEN' | 'MET';
  updatedById: string | null;
  metAt: Date | null;
}

export interface FakeApproval {
  id: string;
  decision: ApprovalDecision;
  comment: string | null;
  baselineSnapshot: unknown;
  baselineHash: string;
  baselineFingerprint: string;
  decidedById: string;
  decidedAt: Date;
  conditions: FakeCondition[];
}

export interface FakeReportVersion {
  id: string;
  version: number;
  status: ReportVersionStatus;
  content: unknown;
  summaryVersion: number | null;
  itemsFingerprint: string | null;
  failureReason: string | null;
  createdById: string;
  submittedById: string | null;
  submittedAt: Date | null;
  outdatedAt: Date | null;
  createdAt: Date;
  projectId: string;
  organizationId: string;
  approval: FakeApproval | null;
}

export const rdb = {
  versions: [] as FakeReportVersion[],
  reset(): void {
    this.versions.length = 0;
  },
};

const inScope = (x: { organizationId: string; projectId: string }, org: string, project: string) =>
  x.organizationId === org && x.projectId === project;

const nameOf = (id: string): string => db.users.get(id)?.name ?? 'Unknown';
const person = (id: string) => ({ id, name: nameOf(id) });

function toItem(
  kind: ReportItem['kind'],
  item: FakeKnowledge,
  modules: Map<string, FakeKnowledge>,
): ReportItem {
  const module = item.moduleId ? modules.get(item.moduleId) : undefined;
  return {
    kind,
    id: item.id,
    title: kind === 'module' ? item.name : item.title,
    description: item.description,
    status: item.status,
    moduleId: kind === 'module' ? null : item.moduleId,
    moduleName: kind === 'module' ? null : (module?.name ?? null),
    sourceChunkId: item.sourceChunkId,
    code: kind === 'module' ? item.code : null,
  };
}

function toRecord(v: FakeReportVersion): VersionRecord {
  return {
    id: v.id,
    version: v.version,
    status: v.status,
    summaryVersion: v.summaryVersion,
    itemsFingerprint: v.itemsFingerprint,
    failureReason: v.failureReason,
    createdAt: v.createdAt,
    submittedAt: v.submittedAt,
    outdatedAt: v.outdatedAt,
    createdBy: person(v.createdById),
    submittedBy: v.submittedById ? person(v.submittedById) : null,
    content: v.content,
    approval: v.approval && {
      decision: v.approval.decision,
      comment: v.approval.comment,
      decidedAt: v.approval.decidedAt,
      baselineHash: v.approval.baselineHash,
      baselineFingerprint: v.approval.baselineFingerprint,
      decidedBy: person(v.approval.decidedById),
      conditions: v.approval.conditions.map((c) => ({
        id: c.id,
        text: c.text,
        status: c.status,
        metAt: c.metAt,
        updatedBy: c.updatedById ? person(c.updatedById) : null,
      })),
    },
  };
}

const find = (org: string, project: string, predicate: (v: FakeReportVersion) => boolean) =>
  rdb.versions.find((v) => inScope(v, org, project) && predicate(v));

const openQuestions = (org: string, project: string) =>
  [...qdb.questions.values()]
    .filter((q) => inScope(q, org, project) && q.status === 'OPEN')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, NORMAL: 2 } as const;

/** In-memory stand-in for the report repository: same scoping and conditional updates, no database. */
export const reportRepository: ReportRepository = {
  projectName: async (org, project) => {
    const p = db.projects.get(project);
    return p && p.organizationId === org ? p.name : null;
  },
  loadItems: async (org, project) => {
    const modules = new Map(
      [...db.modules.values()].filter((m) => inScope(m, org, project)).map((m) => [m.id, m]),
    );
    const of = (map: Map<string, FakeKnowledge>, kind: ReportItem['kind']) =>
      [...map.values()]
        .filter((i) => inScope(i, org, project))
        .map((i) => toItem(kind, i, modules));
    return [
      ...of(db.modules, 'module'),
      ...of(db.requirements, 'requirement'),
      ...of(db.rules, 'rule'),
    ];
  },
  latestSummary: async (org, project) => {
    const latest = qdb.summaries
      .filter((s) => inScope(s, org, project))
      .sort((a, b) => b.version - a.version)[0];
    return latest
      ? { version: latest.version, content: summaryLlmOutputSchema.parse(latest.content) }
      : null;
  },
  findBlockingQuestions: async (org, project) =>
    openQuestions(org, project)
      .filter((q) => q.priority === 'CRITICAL')
      .map((q) => ({ id: q.id, text: q.content, priority: q.priority, reason: q.reason })),
  loadOpenQuestions: async (org, project) => {
    const open = openQuestions(org, project);
    return {
      total: open.length,
      items: open
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        .slice(0, MAX_REPORT_QUESTIONS)
        .map((q) => ({
          id: q.id,
          priority: q.priority,
          reason: q.reason,
          text: q.content,
          moduleName: q.moduleId ? (db.modules.get(q.moduleId)?.name ?? null) : null,
        })),
    };
  },
  loadSourceVersions: async (org, project) => ({
    documents: [...db.versions.values()].flatMap((v) => {
      const doc = db.documents.get(v.documentId);
      return doc && inScope(doc, org, project)
        ? [
            {
              id: doc.id,
              versionId: v.id,
              versionNumber: v.versionNumber,
              contentHash: v.contentHash,
            },
          ]
        : [];
    }),
    notes: [...db.notes.values()]
      .filter((n) => inScope(n, org, project))
      .map((n) => ({ id: n.id, updatedAt: n.updatedAt.toISOString() })),
  }),
  listOwnerIds: async (org, project) =>
    [...db.members.values()]
      .filter((m) => inScope(m, org, project) && m.role === 'OWNER')
      .map((m) => m.userId),
  lockProject: async () => undefined,
  createVersion: async (_db, { organizationId, projectId, userId }) => {
    const version =
      Math.max(
        0,
        ...rdb.versions.filter((v) => inScope(v, organizationId, projectId)).map((v) => v.version),
      ) + 1;
    const record: FakeReportVersion = {
      id: randomUUID(),
      version,
      status: 'GENERATING',
      content: null,
      summaryVersion: null,
      itemsFingerprint: null,
      failureReason: null,
      createdById: userId,
      submittedById: null,
      submittedAt: null,
      outdatedAt: null,
      createdAt: new Date(Date.UTC(2026, 0, 1) + version * 60_000),
      projectId,
      organizationId,
      approval: null,
    };
    rdb.versions.push(record);
    return { id: record.id, version };
  },
  latestVersionNumber: async (org, project) => {
    const numbers = rdb.versions.filter((v) => inScope(v, org, project)).map((v) => v.version);
    return numbers.length === 0 ? null : Math.max(...numbers);
  },
  findVersionById: async (org, project, id) => {
    const v = find(org, project, (x) => x.id === id);
    return v ? { id: v.id, status: v.status } : null;
  },
  completeGeneration: async (_db, p) => {
    const v = find(
      p.organizationId,
      p.projectId,
      (x) => x.id === p.id && x.status === 'GENERATING',
    );
    if (!v) return false;
    Object.assign(v, {
      status: 'DRAFT',
      content: p.content,
      summaryVersion: p.summaryVersion,
      itemsFingerprint: p.itemsFingerprint,
      failureReason: null,
    });
    return true;
  },
  failGeneration: async (org, project, id, reason) => {
    const v = find(org, project, (x) => x.id === id && x.status === 'GENERATING');
    if (!v) return false;
    Object.assign(v, { status: 'FAILED', failureReason: reason });
    return true;
  },
  listVersions: async (org, project) =>
    rdb.versions
      .filter((v) => inScope(v, org, project))
      .sort((a, b) => b.version - a.version)
      .map(toRecord),
  findVersion: async (org, project, version) => {
    const v = find(org, project, (x) => x.version === version);
    return v ? toRecord(v) : null;
  },
  submitVersion: async (_db, p) => {
    const v = find(p.organizationId, p.projectId, (x) => x.id === p.id && x.status === 'DRAFT');
    if (!v) return false;
    Object.assign(v, { status: 'SUBMITTED', submittedById: p.userId, submittedAt: new Date() });
    return true;
  },
  recordDecision: async (_db, p) => {
    const v = find(
      p.organizationId,
      p.projectId,
      (x) => x.id === p.versionId && x.status === 'SUBMITTED',
    );
    if (!v) return null;
    v.status = p.decision;
    v.approval = {
      id: randomUUID(),
      decision: p.decision,
      comment: p.comment,
      baselineSnapshot: p.baseline.snapshot,
      baselineHash: p.baseline.hash,
      baselineFingerprint: p.baseline.fingerprint,
      decidedById: p.decidedById,
      decidedAt: new Date(),
      conditions: p.conditions.map((text) => ({
        id: randomUUID(),
        text,
        status: 'OPEN' as const,
        updatedById: null,
        metAt: null,
      })),
    };
    return v.approval.id;
  },
  findApprovedBaselines: async (org, project) =>
    rdb.versions
      .filter(
        (v) =>
          inScope(v, org, project) &&
          v.approval !== null &&
          (APPROVED_STATUSES as readonly string[]).includes(v.status),
      )
      .map((v) => ({
        versionId: v.id,
        version: v.version,
        baselineFingerprint: v.approval?.baselineFingerprint ?? '',
      })),
  markOutdated: async (_db, org, project, versionId) => {
    const v = find(
      org,
      project,
      (x) => x.id === versionId && (APPROVED_STATUSES as readonly string[]).includes(x.status),
    );
    if (!v) return false;
    Object.assign(v, { status: 'OUTDATED', outdatedAt: new Date() });
    return true;
  },
  findCondition: async (org, project, version, conditionId) => {
    const v = find(org, project, (x) => x.version === version);
    const c = v?.approval?.conditions.find((x) => x.id === conditionId);
    return v && c ? { id: c.id, text: c.text, status: c.status, versionStatus: v.status } : null;
  },
  updateCondition: async (_db, p) => {
    for (const v of rdb.versions) {
      if (v.organizationId !== p.organizationId) continue;
      const c = v.approval?.conditions.find((x) => x.id === p.id);
      if (!c) continue;
      c.updatedById = p.userId;
      if (p.text !== undefined) c.text = p.text;
      if (p.status !== undefined) {
        c.status = p.status;
        c.metAt = p.status === 'MET' ? new Date() : null;
      }
    }
  },
};
