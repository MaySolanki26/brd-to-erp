export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_NOTE_CHARS = 20_000;

export const SOURCE_FILE_TYPES = {
  pdf: {
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  docx: {
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xlsx: {
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
} as const;

export type SourceFileType = keyof typeof SOURCE_FILE_TYPES;

/** Value for an <input type="file" accept> attribute. */
export const SOURCE_FILE_ACCEPT = Object.values(SOURCE_FILE_TYPES)
  .map((t) => t.extension)
  .join(',');

/** Resolves the file type only when the extension and the declared MIME type agree. */
export function sourceFileTypeOf(fileName: string, mimeType: string): SourceFileType | null {
  const lowerName = fileName.trim().toLowerCase();
  const lowerMime = mimeType.trim().toLowerCase();
  for (const [type, spec] of Object.entries(SOURCE_FILE_TYPES)) {
    if (lowerName.endsWith(spec.extension) && lowerMime === spec.mimeType) {
      return type as SourceFileType;
    }
  }
  return null;
}
