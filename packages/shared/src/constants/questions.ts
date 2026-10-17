export const QUESTION_STATUSES = ['OPEN', 'ANSWERED', 'DISMISSED'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_REASONS = ['GAP', 'AMBIGUITY', 'CONFLICT', 'MISSING_RULE'] as const;
export type QuestionReason = (typeof QUESTION_REASONS)[number];

/** Most urgent first, which is also the order questions are shown in. */
export const QUESTION_PRIORITIES = ['CRITICAL', 'HIGH', 'NORMAL'] as const;
export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number];

export const LINKED_ITEM_KINDS = ['requirement', 'rule', 'module'] as const;
export type LinkedItemKind = (typeof LINKED_ITEM_KINDS)[number];

export const MAX_ANSWER_CHARS = 5000;
export const MAX_DISMISS_REASON_CHARS = 500;

/** 0 is the most urgent. */
export function priorityRank(priority: QuestionPriority): number {
  return QUESTION_PRIORITIES.indexOf(priority);
}
