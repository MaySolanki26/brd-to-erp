export const JobName = {
  PROCESS_DOCUMENT: 'process-document',
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

export interface ProcessDocumentPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
}

export interface JobPayloadMap {
  [JobName.PROCESS_DOCUMENT]: ProcessDocumentPayload;
}

export const DEFAULT_BACKOFF = {
  retryLimit: 3,
  retryDelay: 15,
  retryBackoff: true,
} as const;
