import type { KnowledgeStatus } from '../constants/knowledge.js';
import type { PersonRef } from './source.js';

/** Where an item came from: the exact chunk of a document version or a context note. */
export interface KnowledgeSourceDto {
  chunkId: string;
  type: 'document' | 'note';
  sourceId: string;
  sourceTitle: string;
  /** Null for notes. */
  versionNumber: number | null;
  headingPath: string[];
  /** The chunk could not be extracted cleanly and needs a person to check it. */
  needsReview: boolean;
}

interface KnowledgeItemBase {
  id: string;
  status: KnowledgeStatus;
  description: string | null;
  /** The extraction pipeline, or the person who added or edited it. */
  createdBy: 'AI' | PersonRef;
  source: KnowledgeSourceDto;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleRefDto {
  id: string;
  name: string;
}

export interface RequirementDto extends KnowledgeItemBase {
  title: string;
  priority: number | null;
  module: ModuleRefDto | null;
}

export interface BusinessRuleDto extends KnowledgeItemBase {
  title: string;
  module: ModuleRefDto | null;
}

export interface ModuleDto extends KnowledgeItemBase {
  name: string;
  code: string;
  requirementCount: number;
}

export interface ChunkDetailDto {
  id: string;
  chunkIndex: number;
  headingPath: string[];
  content: string;
  needsReview: boolean;
  source: Pick<KnowledgeSourceDto, 'type' | 'sourceId' | 'sourceTitle' | 'versionNumber'>;
}

export type KnowledgeKind = 'requirements' | 'rules' | 'modules';

export interface KnowledgeSummaryDto {
  /** Items per status for each kind; every status is present, zero when empty. */
  counts: Record<KnowledgeKind, Record<KnowledgeStatus, number>>;
  /** Chunks flagged for a person to check. */
  chunksNeedingReview: number;
}
