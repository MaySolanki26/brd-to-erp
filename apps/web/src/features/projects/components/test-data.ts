import type {
  ContextNoteDto,
  DocumentDto,
  DocumentVersionDto,
  ProcessingStatusDto,
} from '@brd/shared';

export const PDF = 'application/pdf';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const person = (name = 'Ann Analyst') => ({ id: 'u1', name });

export function version(overrides: Partial<DocumentVersionDto> = {}): DocumentVersionDto {
  return {
    id: 'v1',
    versionNumber: 1,
    mimeType: PDF,
    sizeBytes: 2048,
    contentHash: 'abcdef1234567890',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: person(),
    ...overrides,
  };
}

export function doc(overrides: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: 'd1',
    title: 'brd.pdf',
    fileName: 'brd.pdf',
    status: 'PROCESSED',
    failureReason: null,
    latestVersion: version(),
    versionCount: 1,
    chunkCount: 4,
    createdBy: person(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function note(overrides: Partial<ContextNoteDto> = {}): ContextNoteDto {
  return {
    id: 'n1',
    title: 'Kickoff call',
    body: '# Goals\nCut errors.',
    status: 'PROCESSED',
    failureReason: null,
    chunkCount: 1,
    createdBy: person(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export const paged = <T>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

export function processingStatus(active = false): { status: ProcessingStatusDto } {
  return {
    status: {
      counts: { UPLOADED: active ? 1 : 0, PROCESSING: 0, PROCESSED: 1, FAILED: 0 },
      chunks: { total: 0, extracted: 0, needingReview: 0 },
      active,
      lastProcessedAt: null,
      sources: [],
    },
  };
}
