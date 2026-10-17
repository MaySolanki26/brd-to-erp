import type { KnowledgeStatus } from '../constants/knowledge.js';
import type {
  LinkedItemKind,
  QuestionPriority,
  QuestionReason,
  QuestionStatus,
} from '../constants/questions.js';
import type { ModuleRefDto } from './knowledge.js';
import type { PersonRef } from './source.js';

/** An item a question is about, with enough detail to show it inline. */
export interface LinkedItemDto {
  kind: LinkedItemKind;
  id: string;
  title: string;
  status: KnowledgeStatus;
}

export interface QuestionAnswerDto {
  id: string;
  text: string;
  answeredBy: PersonRef;
  answeredAt: string;
  /** False while the answer is still waiting to be analysed and applied. */
  applied: boolean;
}

export interface QuestionDismissalDto {
  reason: string;
  at: string;
}

export interface QuestionDto {
  id: string;
  text: string;
  reason: QuestionReason;
  priority: QuestionPriority;
  status: QuestionStatus;
  /** Send this back when answering or dismissing; a mismatch means someone else got there first. */
  version: number;
  module: ModuleRefDto | null;
  linkedItems: LinkedItemDto[];
  answer: QuestionAnswerDto | null;
  dismissal: QuestionDismissalDto | null;
  /** Set when this question was raised by the answer to another one. */
  followUpOf: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionCountsDto {
  byStatus: Record<QuestionStatus, number>;
  /** Open questions only. */
  openByPriority: Record<QuestionPriority, number>;
  openCritical: number;
}

export interface DecisionItemStateDto {
  status: KnowledgeStatus;
  title: string;
  description: string | null;
}

/** One item an answer changed (or deliberately left alone). */
export interface DecisionChangeDto {
  kind: LinkedItemKind;
  id: string;
  /** The title to show: the new one when it changed. */
  title: string;
  before: DecisionItemStateDto;
  after: DecisionItemStateDto;
  reason: string | null;
}

/** A confirmed item the answer contradicted; it was not changed. */
export interface DecisionConflictDto {
  kind: LinkedItemKind;
  id: string;
  title: string | null;
  explanation: string;
}

export interface DecisionDto {
  id: string;
  question: { id: string; text: string };
  answer: string;
  /** One or two sentences on what was decided. */
  summary: string;
  decidedBy: PersonRef;
  decidedAt: string;
  changes: DecisionChangeDto[];
  conflicts: DecisionConflictDto[];
}

export interface SummaryItemRefDto {
  kind: LinkedItemKind;
  id: string;
  title: string;
}

export interface SummaryContentDto {
  overview: string;
  modules: { id: string; name: string; summary: string }[];
  keyRequirements: { id: string; title: string; why: string }[];
  keyRules: { id: string; title: string; why: string }[];
  assumptions: (SummaryItemRefDto & { statement: string })[];
  /** Items whose source changed; later steps must not rely on them. */
  staleItems: SummaryItemRefDto[];
}

export interface SummaryVersionDto {
  version: number;
  generatedAt: string;
}

export interface SummaryDto extends SummaryVersionDto {
  content: SummaryContentDto;
  /** What it was built from, for example item counts. */
  basedOn: Record<string, number>;
}

export interface SummaryResponseDto {
  /** Null until a first summary has been generated. */
  summary: SummaryDto | null;
  /** Newest first. */
  versions: SummaryVersionDto[];
}
