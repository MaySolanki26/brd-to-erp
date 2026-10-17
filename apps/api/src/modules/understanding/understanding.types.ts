import type {
  KnowledgeStatus,
  LinkedItemKind,
  QuestionPriority,
  QuestionReason,
  QuestionStatus,
} from '@brd/shared';

/** How much of the source text an item carries into prompts. */
export const EXCERPT_CHARS = 800;

export interface ItemRef {
  kind: LinkedItemKind;
  id: string;
}

/** An item as the understanding jobs see it, read from the database and never from the model. */
export interface KnowledgeItem extends ItemRef {
  title: string;
  description: string | null;
  status: KnowledgeStatus;
  /** The module the item belongs to; for a module, its own id. */
  moduleId: string | null;
}

export const itemKey = (ref: ItemRef): string => `${ref.kind}:${ref.id}`;

export function indexItems(items: KnowledgeItem[]): Map<string, KnowledgeItem> {
  return new Map(items.map((item) => [itemKey(item), item]));
}

/** An item plus the source text it was taken from, for prompts. */
export interface PromptItem extends KnowledgeItem {
  excerpt: string | null;
}

export interface QuestionContext {
  id: string;
  text: string;
  reason: QuestionReason;
  priority: QuestionPriority;
  moduleId: string | null;
  linked: ItemRef[];
}

export interface AnswerContext {
  answerId: string;
  text: string;
  answeredById: string;
  /** Set once the answer has been applied; a second run must do nothing. */
  appliedAt: Date | null;
  question: QuestionContext;
}

export interface ExistingQuestion {
  id: string;
  status: QuestionStatus;
  reason: QuestionReason;
  text: string;
  linked: ItemRef[];
}
