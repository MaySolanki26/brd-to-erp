import { MAX_UPLOAD_BYTES, SOURCE_FILE_TYPES, type SourceStatus } from '@brd/shared';

/** Picks the MIME type from the file extension; browsers often report none for Office files. */
export function mimeTypeFor(fileName: string): string | null {
  const lower = fileName.trim().toLowerCase();
  const match = Object.values(SOURCE_FILE_TYPES).find((spec) => lower.endsWith(spec.extension));
  return match?.mimeType ?? null;
}

/** Returns a user-facing reason when the file cannot be uploaded, or null when it can. */
export function checkUploadable(file: File): string | null {
  if (!mimeTypeFor(file.name)) return 'Unsupported file. Upload a PDF, DOCX or XLSX file.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    return `The file is larger than ${String(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`;
  }
  return null;
}

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  UPLOADED: 'Queued',
  PROCESSING: 'Processing',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
};

export const SOURCE_STATUS_TONES: Record<SourceStatus, 'neutral' | 'info' | 'success' | 'danger'> =
  {
    UPLOADED: 'neutral',
    PROCESSING: 'info',
    PROCESSED: 'success',
    FAILED: 'danger',
  };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Short label for the kind of file a document is, from its stored MIME type. */
export function fileKindLabel(mimeType: string): string {
  const entry = Object.entries(SOURCE_FILE_TYPES).find(([, spec]) => spec.mimeType === mimeType);
  return entry ? entry[0].toUpperCase() : 'File';
}

export function shortHash(contentHash: string): string {
  return contentHash.slice(0, 8);
}
