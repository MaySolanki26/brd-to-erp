import type { PagedResult } from './project.js';

export type SourceStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface PersonRef {
  id: string;
  name: string;
}

export interface DocumentVersionDto {
  id: string;
  versionNumber: number;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  createdAt: string;
  createdBy: PersonRef;
}

export interface DocumentDto {
  id: string;
  title: string;
  fileName: string;
  status: SourceStatus;
  /** Why processing failed; null unless status is FAILED. */
  failureReason: string | null;
  latestVersion: DocumentVersionDto;
  versionCount: number;
  /** Chunks of the latest version. */
  chunkCount: number;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkDto {
  id: string;
  chunkIndex: number;
  headingPath: string[];
  content: string;
}

export interface DocumentDetailDto extends DocumentDto {
  versions: DocumentVersionDto[];
  /** The version the chunks belong to (the latest unless requested otherwise). */
  chunksVersionId: string;
  chunks: PagedResult<ChunkDto>;
}

export interface UploadUrlDto {
  uploadUrl: string;
  /** Signed proof of this upload request; send it back to confirm. */
  ticket: string;
  expiresAt: string;
}

export interface ConfirmUploadDto {
  document: DocumentDto;
  /** Set when another document in the project has identical content. */
  duplicateOf: { documentId: string; title: string } | null;
}

export interface ContextNoteDto {
  id: string;
  title: string;
  body: string;
  status: SourceStatus;
  failureReason: string | null;
  chunkCount: number;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingSourceDto {
  type: 'document' | 'note';
  id: string;
  title: string;
  status: SourceStatus;
}

export interface ProcessingStatusDto {
  counts: Record<SourceStatus, number>;
  /** True while any source is still waiting or being processed. */
  active: boolean;
  /** When the most recent source finished processing; null if none has. */
  lastProcessedAt: string | null;
  /**
   * True while the project's monthly LLM token budget is used up: analysis jobs are waiting and
   * resume on their own once the budget allows. The server always sends it.
   */
  llmPaused?: boolean;
  sources: ProcessingSourceDto[];
}
