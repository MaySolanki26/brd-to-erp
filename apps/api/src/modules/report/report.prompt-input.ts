import { wrap } from '../understanding/prompt-inputs.js';
import type { ReportCounts } from './report.content.js';
import type { OpenQuestion, StoredSummary } from './report.types.js';

/** How many open questions the model sees; the total is always given. */
export const QUESTIONS_FOR_NARRATIVE = 30;

/**
 * What the model reads to write the narrative: the project summary, counts and the most urgent open
 * questions. Never a document, a chunk or the full list of items.
 */
export function reportInput(input: {
  projectName: string;
  summary: StoredSummary;
  counts: ReportCounts;
  openQuestions: { total: number; items: OpenQuestion[] };
}): string {
  const { summary } = input;
  return wrap({
    project: input.projectName,
    summary: {
      overview: summary.content.overview,
      modules: summary.content.modules.map((m) => ({
        id: m.moduleId,
        name: m.name,
        summary: m.summary,
      })),
      keyRequirements: summary.content.keyRequirements,
      keyRules: summary.content.keyRules,
      assumptions: summary.content.assumptions,
      staleItems: summary.content.staleItems,
    },
    counts: input.counts,
    openQuestionTotal: input.openQuestions.total,
    openQuestions: input.openQuestions.items.slice(0, QUESTIONS_FOR_NARRATIVE).map((q) => ({
      priority: q.priority,
      reason: q.reason,
      text: q.text,
      moduleName: q.moduleName,
    })),
  });
}
