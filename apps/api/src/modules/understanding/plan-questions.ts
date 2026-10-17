import {
  priorityRank,
  type GeneratedQuestion,
  type QuestionPriority,
  type QuestionReason,
} from '@brd/shared';
import { questionDedupeKey } from './dedupe.js';
import { indexItems, itemKey, type ItemRef, type KnowledgeItem } from './understanding.types.js';

export const MAX_QUESTIONS_PER_RUN = 20;
export const MAX_QUESTION_CHARS = 1000;

export interface PlannedQuestion {
  reason: QuestionReason;
  priority: QuestionPriority;
  text: string;
  moduleId: string | null;
  linkedItems: ItemRef[];
  dedupeKey: string;
}

export interface QuestionPlan {
  questions: PlannedQuestion[];
  dropped: { noValidItems: number; emptyText: number; duplicate: number; overLimit: number };
}

const tidy = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS);

/** A question about one module's items belongs to that module, even if the model left it out. */
function resolveModule(
  requested: string | null,
  linked: KnowledgeItem[],
  moduleIds: Set<string>,
): string | null {
  if (requested && moduleIds.has(requested)) return requested;
  const modules = new Set(linked.map((i) => i.moduleId));
  const only = modules.size === 1 ? [...modules][0] : null;
  return only && moduleIds.has(only) ? only : null;
}

/**
 * Turns what the model proposed into questions that are safe to store. Nothing the model names is
 * trusted: items must exist in this project, rejected items are not asked about, and a gap already
 * asked (in any state, including dismissed) is skipped.
 */
export function planQuestions(
  generated: GeneratedQuestion[],
  items: KnowledgeItem[],
  moduleIds: Set<string>,
  existingKeys: Set<string>,
): QuestionPlan {
  const known = indexItems(items);
  const seen = new Set(existingKeys);
  const dropped = { noValidItems: 0, emptyText: 0, duplicate: 0, overLimit: 0 };
  const accepted: PlannedQuestion[] = [];

  for (const candidate of generated) {
    const text = tidy(candidate.text);
    if (!text) {
      dropped.emptyText += 1;
      continue;
    }
    const linked = [...new Map(candidate.linkedItems.map((r) => [itemKey(r), r])).values()]
      .map((ref) => known.get(itemKey(ref)))
      .filter((item): item is KnowledgeItem => item !== undefined && item.status !== 'REJECTED');
    if (linked.length === 0) {
      dropped.noValidItems += 1;
      continue;
    }
    const linkedItems = linked.map(({ kind, id }) => ({ kind, id }));
    const moduleId = resolveModule(candidate.moduleId, linked, moduleIds);
    const dedupeKey = questionDedupeKey({ reason: candidate.reason, moduleId, linkedItems });
    if (seen.has(dedupeKey)) {
      dropped.duplicate += 1;
      continue;
    }
    seen.add(dedupeKey);
    accepted.push({
      reason: candidate.reason,
      priority: candidate.priority,
      text,
      moduleId,
      linkedItems,
      dedupeKey,
    });
  }

  // Most urgent first, so the cap keeps the questions that matter most.
  const ranked = accepted
    .map((q, index) => ({ q, index }))
    .sort((a, b) => priorityRank(a.q.priority) - priorityRank(b.q.priority) || a.index - b.index)
    .map(({ q }) => q);
  dropped.overLimit = Math.max(0, ranked.length - MAX_QUESTIONS_PER_RUN);
  return { questions: ranked.slice(0, MAX_QUESTIONS_PER_RUN), dropped };
}
