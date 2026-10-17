export const JobName = {
  PROCESS_SOURCE: 'process-source',
  REFRESH_SUMMARY: 'refresh-summary',
  GENERATE_QUESTIONS: 'generate-questions',
  APPLY_ANSWER: 'apply-answer',
  EXTRACT_CHUNK: 'extract-chunk',
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

/** The worker re-verifies every id against the database before doing any work. */
export interface ProcessSourcePayload {
  organizationId: string;
  projectId: string;
  sourceType: 'document' | 'note';
  /** Document id or context note id. */
  sourceId: string;
  /** Required for documents: the version to parse. */
  versionId?: string;
  /** A person asked to reprocess: extract every chunk again, even those whose text did not change. */
  reextract?: boolean;
}

/** Rebuilds the versioned project summary; does nothing when the inputs have not changed. */
export interface RefreshSummaryPayload {
  organizationId: string;
  projectId: string;
}

/** Looks for gaps, ambiguities, conflicts and missing rules in the project's items. */
export interface GenerateQuestionsPayload {
  organizationId: string;
  projectId: string;
}

/** Applies one recorded answer to the items its question is linked to. */
export interface ApplyAnswerPayload {
  organizationId: string;
  projectId: string;
  answerId: string;
}

/** Lists the modules, requirements and rules one chunk states. The worker re-verifies the chunk. */
export interface ExtractChunkPayload {
  organizationId: string;
  projectId: string;
  chunkId: string;
}

export interface JobPayloadMap {
  [JobName.PROCESS_SOURCE]: ProcessSourcePayload;
  [JobName.REFRESH_SUMMARY]: RefreshSummaryPayload;
  [JobName.GENERATE_QUESTIONS]: GenerateQuestionsPayload;
  [JobName.APPLY_ANSWER]: ApplyAnswerPayload;
  [JobName.EXTRACT_CHUNK]: ExtractChunkPayload;
}

export const DEFAULT_BACKOFF = {
  retryLimit: 3,
  retryDelay: 15,
  retryBackoff: true,
} as const;
