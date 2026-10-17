import type {
  ApplyAnswerLlmOutput,
  DecisionConflictDto,
  GeneratedQuestion,
  KnowledgeStatus,
} from '@brd/shared';
import { indexItems, itemKey, type ItemRef, type KnowledgeItem } from './understanding.types.js';

const MAX_TITLE_CHARS = 300;
const MAX_DESCRIPTION_CHARS = 4000;
const MAX_REASON_CHARS = 300;
const MAX_SUMMARY_CHARS = 500;
export const NO_SUMMARY = 'The answer was recorded.';

export interface ItemState {
  status: KnowledgeStatus;
  title: string;
  description: string | null;
}

export interface PlannedChange extends ItemRef {
  before: ItemState;
  after: ItemState;
  reason: string | null;
}

export interface AnswerPlan {
  changes: PlannedChange[];
  conflicts: (DecisionConflictDto & { moduleId: string | null })[];
  followUps: GeneratedQuestion[];
  summary: string;
}

const tidy = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max);
const stateOf = (i: KnowledgeItem): ItemState => ({
  status: i.status,
  title: i.title,
  description: i.description,
});

/**
 * Decides what an answer may change. The model only proposes: it can touch the items its question is
 * linked to and nothing else, and an item a person has CONFIRMED is never altered. If the model
 * tries, the attempt is recorded as a conflict for a person to resolve.
 */
export function planAnswer(output: ApplyAnswerLlmOutput, linked: KnowledgeItem[]): AnswerPlan {
  const known = indexItems(linked);
  const changes = new Map<string, PlannedChange>();
  const conflicts = new Map<string, AnswerPlan['conflicts'][number]>();

  const addConflict = (item: KnowledgeItem, explanation: string): void => {
    const key = itemKey(item);
    if (conflicts.has(key)) return;
    conflicts.set(key, {
      kind: item.kind,
      id: item.id,
      title: item.title,
      explanation:
        tidy(explanation, MAX_REASON_CHARS) || 'The answer disagrees with this confirmed item.',
      moduleId: item.moduleId,
    });
  };

  for (const proposed of output.conflicts) {
    const item = known.get(itemKey(proposed));
    if (item?.status === 'CONFIRMED') addConflict(item, proposed.explanation);
  }

  for (const proposed of output.changes) {
    const item = known.get(itemKey(proposed));
    if (!item) continue;
    const key = itemKey(item);
    if (changes.has(key) || conflicts.has(key)) continue;
    if (item.status === 'CONFIRMED') {
      addConflict(item, proposed.reason || 'The answer would change this confirmed item.');
      continue;
    }

    const after: ItemState = {
      status: proposed.newStatus ?? item.status,
      title: proposed.newTitle
        ? tidy(proposed.newTitle, MAX_TITLE_CHARS) || item.title
        : item.title,
      description:
        proposed.newDescription !== null
          ? tidy(proposed.newDescription, MAX_DESCRIPTION_CHARS) || item.description
          : item.description,
    };
    const before = stateOf(item);
    if (
      after.status === before.status &&
      after.title === before.title &&
      after.description === before.description
    ) {
      continue;
    }
    changes.set(key, {
      kind: item.kind,
      id: item.id,
      before,
      after,
      reason: tidy(proposed.reason, MAX_REASON_CHARS) || null,
    });
  }

  return {
    changes: [...changes.values()],
    conflicts: [...conflicts.values()],
    followUps: output.followUpQuestions,
    summary: tidy(output.decisionSummary, MAX_SUMMARY_CHARS) || NO_SUMMARY,
  };
}

/** The question raised for a CONFIRMED item the answer contradicted. Worded by us, not the model. */
export function conflictQuestion(conflict: AnswerPlan['conflicts'][number]): GeneratedQuestion {
  return {
    reason: 'CONFLICT',
    priority: 'CRITICAL',
    text: `A recent answer seems to disagree with "${conflict.title ?? 'a confirmed item'}", which was confirmed earlier. ${conflict.explanation} Which one is correct?`,
    moduleId: conflict.moduleId,
    linkedItems: [{ kind: conflict.kind, id: conflict.id }],
  };
}
