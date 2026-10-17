import type {
  KnowledgeStatus,
  QuestionPriority,
  QuestionReason,
  SummaryLlmOutput,
} from '@brd/shared';

/** A requirement, rule or module as the report and its baseline see it. */
export interface ReportItem {
  kind: 'requirement' | 'rule' | 'module';
  id: string;
  title: string;
  description: string | null;
  status: KnowledgeStatus;
  /** The module an item belongs to; null for modules and for items with none. */
  moduleId: string | null;
  moduleName: string | null;
  sourceChunkId: string;
  /** Modules only. */
  code: string | null;
}

export interface OpenQuestion {
  id: string;
  priority: QuestionPriority;
  reason: QuestionReason;
  text: string;
  moduleName: string | null;
}

export interface StoredSummary {
  version: number;
  content: SummaryLlmOutput;
}

export interface SourceVersions {
  documents: { id: string; versionId: string; versionNumber: number; contentHash: string }[];
  notes: { id: string; updatedAt: string }[];
}
