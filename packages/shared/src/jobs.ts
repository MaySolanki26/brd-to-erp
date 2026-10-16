export const JobName = {
  PROCESS_SOURCE: 'process-source',
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
}

export interface JobPayloadMap {
  [JobName.PROCESS_SOURCE]: ProcessSourcePayload;
}

export const DEFAULT_BACKOFF = {
  retryLimit: 3,
  retryDelay: 15,
  retryBackoff: true,
} as const;
