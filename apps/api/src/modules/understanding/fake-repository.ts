import { randomUUID } from 'node:crypto';
import { summaryLlmOutputSchema, type SummaryLlmOutput } from '@brd/shared';
import type { PlannedQuestion } from './plan-questions.js';
import type { PlannedChange } from './plan-answer.js';
import type { UnderstandingRepository } from './understanding.repository.js';
import { itemKey, type AnswerContext, type PromptItem } from './understanding.types.js';

export interface FakeQuestion extends PlannedQuestion {
  id: string;
  parentQuestionId: string | null;
  status: 'OPEN' | 'ANSWERED' | 'DISMISSED';
}

export interface FakeSummary {
  version: number;
  fingerprint: string;
  content: SummaryLlmOutput;
  basedOn: Record<string, number>;
}

export interface FakeDecision {
  id: string;
  answerId: string;
  questionId: string;
  summary: string;
  changes: PlannedChange[];
  conflicts: { kind: string; id: string; title: string | null; explanation: string }[];
}

/** An in-memory stand-in for the repository: same rules (tenant, uniqueness, claim), no database. */
export function createFakeRepository(seed: {
  projectId: string;
  organizationId: string;
  items?: PromptItem[];
  answers?: AnswerContext[];
}) {
  const state = {
    // Copies, so one test updating an item never changes the fixture another test starts from.
    items: (seed.items ?? []).map((i) => ({ ...i })),
    questions: [] as FakeQuestion[],
    summaries: [] as FakeSummary[],
    answers: new Map((seed.answers ?? []).map((a) => [a.answerId, { ...a }])),
    decisions: [] as FakeDecision[],
    /** Items an update is refused for, as if they had just been confirmed. */
    refuseUpdates: new Set<string>(),
    /** Called before the summary transaction, to simulate another worker. */
    beforeSummaryWrite: undefined as (() => void) | undefined,
    claimsDenied: false,
  };
  const inScope = (org: string, project: string): boolean =>
    org === seed.organizationId && project === seed.projectId;

  const repo: UnderstandingRepository = {
    projectName: async (org, project) => (inScope(org, project) ? 'Test project' : null),
    loadItems: async (org, project) => (inScope(org, project) ? state.items : []),
    listQuestionKeys: async () => new Set(state.questions.map((q) => q.dedupeKey)),
    listQuestionsForPrompt: async () =>
      state.questions.map((q) => ({
        id: q.id,
        status: q.status,
        reason: q.reason,
        text: q.text,
        linked: q.linkedItems,
      })),
    countOpenQuestions: async () => state.questions.filter((q) => q.status === 'OPEN').length,
    insertQuestions: async (_db, params) => {
      let created = 0;
      for (const q of params.questions) {
        if (state.questions.some((x) => x.dedupeKey === q.dedupeKey)) continue;
        state.questions.push({
          ...q,
          id: randomUUID(),
          parentQuestionId: params.parentQuestionId,
          status: 'OPEN',
        });
        created += 1;
      }
      return created;
    },
    latestSummary: async () => {
      const latest = state.summaries.at(-1);
      return latest
        ? {
            version: latest.version,
            fingerprint: latest.fingerprint,
            content: summaryLlmOutputSchema.parse(latest.content),
          }
        : null;
    },
    lockProject: async () => {
      state.beforeSummaryWrite?.();
    },
    createSummary: async (_db, params) => {
      const version = (state.summaries.at(-1)?.version ?? 0) + 1;
      state.summaries.push({
        version,
        fingerprint: params.fingerprint,
        content: params.content,
        basedOn: params.basedOn,
      });
      return { id: randomUUID(), version };
    },
    findAnswerContext: async (org, project, answerId) =>
      inScope(org, project) ? (state.answers.get(answerId) ?? null) : null,
    claimAnswer: async (_db, _org, _project, answerId) => {
      const answer = state.answers.get(answerId);
      if (!answer || answer.appliedAt || state.claimsDenied) return false;
      answer.appliedAt = new Date();
      return true;
    },
    updateItem: async (_db, _org, _project, change) => {
      const item = state.items.find((i) => itemKey(i) === itemKey(change));
      if (!item || item.status === 'CONFIRMED' || state.refuseUpdates.has(itemKey(change))) {
        return false;
      }
      item.status = change.after.status;
      item.title = change.after.title;
      item.description = change.after.description;
      return true;
    },
    createDecision: async (_db, params) => {
      const decision: FakeDecision = {
        id: randomUUID(),
        answerId: params.answerId,
        questionId: params.questionId,
        summary: params.summary,
        changes: params.changes as PlannedChange[],
        conflicts: params.conflicts as FakeDecision['conflicts'],
      };
      state.decisions.push(decision);
      return decision.id;
    },
  };
  return { repo, state };
}
