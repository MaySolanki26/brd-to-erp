import { randomUUID } from 'node:crypto';
import { chunkRecord, db, type FakeChunk } from './fake-db.js';

type Status = 'OPEN' | 'ANSWERED' | 'DISMISSED';
type Reason = 'GAP' | 'AMBIGUITY' | 'CONFLICT' | 'MISSING_RULE';
type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL';
const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'NORMAL'];

export interface FakeLink {
  kind: 'requirement' | 'rule' | 'module';
  id: string;
}

export interface FakeQuestion {
  id: string;
  content: string;
  status: Status;
  reason: Reason;
  priority: Priority;
  version: number;
  moduleId: string | null;
  parentQuestionId: string | null;
  dismissReason: string | null;
  dismissedAt: Date | null;
  dismissedById: string | null;
  projectId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  links: FakeLink[];
}

export interface FakeAnswer {
  id: string;
  content: string;
  questionId: string;
  answeredById: string;
  projectId: string;
  organizationId: string;
  createdAt: Date;
  appliedAt: Date | null;
}

export interface FakeDecision {
  id: string;
  questionId: string;
  answerId: string;
  decidedById: string;
  summary: string;
  changes: unknown;
  conflicts: unknown;
  projectId: string;
  organizationId: string;
  createdAt: Date;
}

export interface FakeSummary {
  version: number;
  content: unknown;
  basedOn: unknown;
  projectId: string;
  organizationId: string;
  generatedAt: Date;
}

export const qdb = {
  questions: new Map<string, FakeQuestion>(),
  answers: new Map<string, FakeAnswer>(),
  decisions: new Map<string, FakeDecision>(),
  summaries: [] as FakeSummary[],
  reset(): void {
    this.questions.clear();
    this.answers.clear();
    this.decisions.clear();
    this.summaries.length = 0;
  },
};

let clock = 0;
const tick = (): Date => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000);

export function addQuestion(
  partial: Pick<FakeQuestion, 'organizationId' | 'projectId'> & Partial<FakeQuestion>,
): FakeQuestion {
  const now = tick();
  const question: FakeQuestion = {
    id: randomUUID(),
    content: 'What happens to unpaid invoices?',
    status: 'OPEN',
    reason: 'GAP',
    priority: 'NORMAL',
    version: 1,
    moduleId: null,
    parentQuestionId: null,
    dismissReason: null,
    dismissedAt: null,
    dismissedById: null,
    createdAt: now,
    updatedAt: now,
    links: [],
    ...partial,
  };
  qdb.questions.set(question.id, question);
  return question;
}

export function addAnswer(
  partial: Pick<FakeAnswer, 'questionId' | 'answeredById' | 'projectId' | 'organizationId'> &
    Partial<FakeAnswer>,
): FakeAnswer {
  const answer: FakeAnswer = {
    id: randomUUID(),
    content: 'Send a reminder after 7 days.',
    createdAt: tick(),
    appliedAt: null,
    ...partial,
  };
  qdb.answers.set(answer.id, answer);
  return answer;
}

export function addDecision(
  partial: Pick<
    FakeDecision,
    'questionId' | 'answerId' | 'decidedById' | 'projectId' | 'organizationId'
  > &
    Partial<FakeDecision>,
): FakeDecision {
  const decision: FakeDecision = {
    id: randomUUID(),
    summary: 'Reminders go out after 7 days.',
    changes: [],
    conflicts: [],
    createdAt: tick(),
    ...partial,
  };
  qdb.decisions.set(decision.id, decision);
  return decision;
}

export function addSummary(
  partial: Pick<FakeSummary, 'projectId' | 'organizationId'> & Partial<FakeSummary>,
): FakeSummary {
  const summary: FakeSummary = {
    version: qdb.summaries.filter((s) => s.projectId === partial.projectId).length + 1,
    content: {
      overview: 'An ERP for invoicing.',
      modules: [],
      keyRequirements: [],
      keyRules: [],
      assumptions: [],
      staleItems: [],
    },
    basedOn: { requirements: 0 },
    generatedAt: tick(),
    ...partial,
  };
  qdb.summaries.push(summary);
  return summary;
}

const inScope = (x: { organizationId: string; projectId: string }, org: string, project: string) =>
  x.organizationId === org && x.projectId === project;

const person = (userId: string) => ({ id: userId, name: db.users.get(userId)?.name ?? 'Unknown' });

function latestAnswer(questionId: string): FakeAnswer | undefined {
  return [...qdb.answers.values()]
    .filter((a) => a.questionId === questionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function linkRecord(link: FakeLink) {
  const item =
    link.kind === 'requirement'
      ? db.requirements.get(link.id)
      : link.kind === 'rule'
        ? db.rules.get(link.id)
        : db.modules.get(link.id);
  if (!item) return { requirement: null, rule: null, module: null };
  if (link.kind === 'requirement') {
    return {
      requirement: { id: item.id, title: item.title, status: item.status, sourceChunk: sourceOf(item) },
      rule: null,
      module: null,
    };
  }
  if (link.kind === 'rule') {
    return {
      requirement: null,
      rule: { id: item.id, title: item.title, status: item.status, sourceChunk: sourceOf(item) },
      module: null,
    };
  }
  return {
    requirement: null,
    rule: null,
    module: { id: item.id, name: item.name, status: item.status, sourceChunk: sourceOf(item) },
  };
}

function sourceOf(item: { sourceChunkId: string }) {
  return chunkRecord(db.chunks.get(item.sourceChunkId) as FakeChunk);
}

function questionRecord(q: FakeQuestion) {
  const answer = latestAnswer(q.id);
  const module = q.moduleId ? db.modules.get(q.moduleId) : undefined;
  return {
    id: q.id,
    content: q.content,
    status: q.status,
    reason: q.reason,
    priority: q.priority,
    version: q.version,
    dismissReason: q.dismissReason,
    dismissedAt: q.dismissedAt,
    parentQuestionId: q.parentQuestionId,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    module: module ? { id: module.id, name: module.name } : null,
    links: q.links.map(linkRecord),
    answers: answer
      ? [
          {
            id: answer.id,
            content: answer.content,
            createdAt: answer.createdAt,
            appliedAt: answer.appliedAt,
            answeredBy: person(answer.answeredById),
          },
        ]
      : [],
  };
}

interface Filter {
  organizationId: string;
  projectId: string;
  status?: Status | undefined;
  reason?: Reason | undefined;
  priority?: Priority | undefined;
  moduleId?: string | undefined;
}

function matching(f: Filter): FakeQuestion[] {
  return [...qdb.questions.values()].filter(
    (q) =>
      inScope(q, f.organizationId, f.projectId) &&
      (!f.status || q.status === f.status) &&
      (!f.reason || q.reason === f.reason) &&
      (!f.priority || q.priority === f.priority) &&
      (!f.moduleId || q.moduleId === f.moduleId),
  );
}

export const questionsRepositoryModule = {
  listQuestions: async (f: Filter & { page: number; pageSize: number }) => {
    const all = matching(f).sort(
      (a, b) =>
        PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    const start = (f.page - 1) * f.pageSize;
    const groups = new Map<string, { moduleId: string | null; priority: Priority; count: number }>();
    for (const q of all) {
      const key = `${q.moduleId ?? ''}|${q.priority}`;
      const group = groups.get(key) ?? { moduleId: q.moduleId, priority: q.priority, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    return {
      items: all.slice(start, start + f.pageSize).map(questionRecord),
      total: all.length,
      moduleCounts: [...groups.values()],
    };
  },
  countByStatus: async (organizationId: string, projectId: string) => {
    const counts = new Map<Status, number>();
    for (const q of matching({ organizationId, projectId })) {
      counts.set(q.status, (counts.get(q.status) ?? 0) + 1);
    }
    return [...counts].map(([status, count]) => ({ status, count }));
  },
  countOpenByPriority: async (organizationId: string, projectId: string) => {
    const counts = new Map<Priority, number>();
    for (const q of matching({ organizationId, projectId, status: 'OPEN' })) {
      counts.set(q.priority, (counts.get(q.priority) ?? 0) + 1);
    }
    return [...counts].map(([priority, count]) => ({ priority, count }));
  },
  findQuestion: async (organizationId: string, projectId: string, questionId: string) => {
    const q = qdb.questions.get(questionId);
    return q && inScope(q, organizationId, projectId) ? questionRecord(q) : null;
  },
  findConflictState: async (organizationId: string, projectId: string, questionId: string) => {
    const q = qdb.questions.get(questionId);
    if (!q || !inScope(q, organizationId, projectId)) return null;
    const answer = latestAnswer(q.id);
    return {
      status: q.status,
      version: q.version,
      dismissedBy: q.dismissedById ? { name: person(q.dismissedById).name } : null,
      answers: answer ? [{ answeredBy: { name: person(answer.answeredById).name } }] : [],
    };
  },
  claimForAnswer: async (claim: {
    organizationId: string;
    projectId: string;
    questionId: string;
    version: number;
  }): Promise<boolean> => {
    const q = qdb.questions.get(claim.questionId);
    if (!q || !inScope(q, claim.organizationId, claim.projectId)) return false;
    if (q.status !== 'OPEN' || q.version !== claim.version) return false;
    q.status = 'ANSWERED';
    q.version += 1;
    q.updatedAt = tick();
    return true;
  },
  claimForDismissal: async (claim: {
    organizationId: string;
    projectId: string;
    questionId: string;
    version: number;
    reason: string;
    dismissedById: string;
    dismissedAt: Date;
  }): Promise<boolean> => {
    const q = qdb.questions.get(claim.questionId);
    if (!q || !inScope(q, claim.organizationId, claim.projectId)) return false;
    if (q.status !== 'OPEN' || q.version !== claim.version) return false;
    q.status = 'DISMISSED';
    q.version += 1;
    q.dismissReason = claim.reason;
    q.dismissedById = claim.dismissedById;
    q.dismissedAt = claim.dismissedAt;
    q.updatedAt = tick();
    return true;
  },
  createAnswer: async (data: {
    content: string;
    questionId: string;
    answeredById: string;
    projectId: string;
    organizationId: string;
  }) => ({ id: addAnswer(data).id }),
};

export const decisionsRepositoryModule = {
  listDecisions: async (p: {
    organizationId: string;
    projectId: string;
    page: number;
    pageSize: number;
  }) => {
    const all = [...qdb.decisions.values()]
      .filter((d) => inScope(d, p.organizationId, p.projectId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const start = (p.page - 1) * p.pageSize;
    const items = all.slice(start, start + p.pageSize).map((d) => ({
      id: d.id,
      summary: d.summary,
      changes: d.changes,
      conflicts: d.conflicts,
      createdAt: d.createdAt,
      decidedBy: person(d.decidedById),
      question: { id: d.questionId, content: qdb.questions.get(d.questionId)?.content ?? '' },
      answer: { content: qdb.answers.get(d.answerId)?.content ?? '' },
    }));
    return { items, total: all.length };
  },
};

export const summaryRepositoryModule = {
  listVersions: async (organizationId: string, projectId: string) =>
    qdb.summaries
      .filter((s) => inScope(s, organizationId, projectId))
      .sort((a, b) => b.version - a.version)
      .map((s) => ({ version: s.version, generatedAt: s.generatedAt })),
  findSummary: async (organizationId: string, projectId: string, version?: number) =>
    qdb.summaries
      .filter(
        (s) =>
          inScope(s, organizationId, projectId) && (version === undefined || s.version === version),
      )
      .sort((a, b) => b.version - a.version)[0] ?? null,
  findItemTitles: async (
    organizationId: string,
    projectId: string,
    ids: { requirements: string[]; rules: string[]; modules: string[] },
  ) => {
    const titles = new Map<string, string>();
    const add = (
      kind: string,
      map: typeof db.requirements,
      wanted: string[],
      field: 'title' | 'name',
    ) => {
      for (const id of wanted) {
        const item = map.get(id);
        if (item && inScope(item, organizationId, projectId))
          titles.set(`${kind}:${id}`, item[field]);
      }
    };
    add('requirement', db.requirements, ids.requirements, 'title');
    add('rule', db.rules, ids.rules, 'title');
    add('module', db.modules, ids.modules, 'name');
    return titles;
  },
};
