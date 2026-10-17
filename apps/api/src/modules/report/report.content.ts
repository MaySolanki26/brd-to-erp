import {
  KNOWLEDGE_STATUSES,
  reportContentSchema,
  type KnowledgeStatus,
  type ReportContent,
  type ReportLlmOutput,
  type ReportNarrative,
} from '@brd/shared';
import type { OpenQuestion, ReportItem, StoredSummary } from './report.types.js';

const MAX_LINE_CHARS = 500;
const MAX_CONFIDENCE_CHARS = 1500;
const MAX_OBJECTIVES = 8;
const MAX_SCOPE_LINES = 20;
const MAX_ROLES = 15;
const MAX_RISKS = 8;
/** The report lists open questions up to this many; the total is always given. */
export const MAX_REPORT_QUESTIONS = 200;

const clip = (text: string, max = MAX_LINE_CHARS): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, max);

const lines = (values: string[], max: number): string[] =>
  values
    .map((v) => clip(v))
    .filter((v) => v !== '')
    .slice(0, max);

/** The model's narrative is a draft: trim it, cap it, and drop anything empty. */
export function sanitizeNarrative(output: ReportLlmOutput): ReportNarrative {
  return {
    objectives: lines(output.objectives, MAX_OBJECTIVES),
    scope: {
      inScope: lines(output.scope.inScope, MAX_SCOPE_LINES),
      outOfScope: lines(output.scope.outOfScope, MAX_SCOPE_LINES),
    },
    roles: output.roles
      .map((r) => ({ name: clip(r.name, 120), description: clip(r.description) }))
      .filter((r) => r.name !== '')
      .slice(0, MAX_ROLES),
    risks: output.risks
      .map((r) => ({
        title: clip(r.title, 200),
        description: clip(r.description),
        severity: r.severity,
      }))
      .filter((r) => r.title !== '')
      .slice(0, MAX_RISKS),
    confidence: clip(output.confidence, MAX_CONFIDENCE_CHARS),
  };
}

function countByStatus(items: ReportItem[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(KNOWLEDGE_STATUSES.map((s) => [s, 0]));
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}

export type ReportCounts = ReportContent['counts'];

/** How many requirements, rules and modules the project has in each status. */
export function countItems(items: ReportItem[]): ReportCounts {
  const ofKind = (kind: ReportItem['kind']) => countByStatus(items.filter((i) => i.kind === kind));
  return { requirements: ofKind('requirement'), rules: ofKind('rule'), modules: ofKind('module') };
}

const STATUS_ORDER: Record<KnowledgeStatus, number> = {
  CONFIRMED: 0,
  ASSUMED: 1,
  OPEN: 2,
  NEEDS_REVALIDATION: 3,
  REJECTED: 4,
};

function byStatusThenTitle(a: ReportItem, b: ReportItem): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title);
}

/**
 * Assembles a report. The facts (modules, requirements, rules, assumptions, open questions) come
 * straight from the project's records, so the model cannot invent or drop any; only the narrative
 * comes from the model.
 */
export function buildReportContent(input: {
  projectName: string;
  summary: StoredSummary;
  items: ReportItem[];
  openQuestions: { total: number; items: OpenQuestion[] };
  narrative: ReportNarrative;
}): ReportContent {
  const { items } = input;
  const ofKind = (kind: ReportItem['kind']) => items.filter((i) => i.kind === kind);
  const titleOf = new Map(items.map((i) => [`${i.kind}:${i.id}`, i.title]));

  const content: ReportContent = {
    projectName: input.projectName,
    summaryVersion: input.summary.version,
    narrative: input.narrative,
    counts: countItems(items),
    modules: ofKind('module')
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((m) => ({
        id: m.id,
        name: m.title,
        code: m.code ?? '',
        description: m.description,
        status: m.status,
      })),
    requirements: ofKind('requirement')
      .sort(byStatusThenTitle)
      .map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        moduleName: i.moduleName,
      })),
    rules: ofKind('rule')
      .sort(byStatusThenTitle)
      .map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        moduleName: i.moduleName,
      })),
    // Assumptions come from the summary, but only those whose item still exists, with current titles.
    assumptions: input.summary.content.assumptions.flatMap((a) => {
      const title = titleOf.get(`${a.itemKind}:${a.itemId}`);
      return title === undefined
        ? []
        : [{ kind: a.itemKind, id: a.itemId, title, statement: clip(a.statement) }];
    }),
    openQuestions: {
      total: input.openQuestions.total,
      items: input.openQuestions.items.slice(0, MAX_REPORT_QUESTIONS),
    },
  };
  // A report that does not match its own schema is a bug, not something to store.
  return reportContentSchema.parse(content);
}
