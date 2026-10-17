export const KNOWLEDGE_STATUSES = [
  'CONFIRMED',
  'ASSUMED',
  'OPEN',
  'REJECTED',
  'NEEDS_REVALIDATION',
] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/** Statuses that ask a person to look at the item again. */
export const ATTENTION_STATUSES: readonly KnowledgeStatus[] = ['NEEDS_REVALIDATION'];
