import { SOURCE_FILE_TYPES, type SourceFileType } from '@brd/shared';
import { parseDocx } from './docx.js';
import { parsePdf } from './pdf.js';
import type { ParsedSection } from './types.js';
import { parseXlsx } from './xlsx.js';

export { parseNote } from './note.js';
export type { ParsedSection } from './types.js';

export function fileTypeFromMime(mimeType: string): SourceFileType | null {
  const entry = Object.entries(SOURCE_FILE_TYPES).find(([, spec]) => spec.mimeType === mimeType);
  return entry ? (entry[0] as SourceFileType) : null;
}

export function parseFile(type: SourceFileType, data: Buffer): Promise<ParsedSection[]> {
  switch (type) {
    case 'pdf':
      return parsePdf(data);
    case 'docx':
      return parseDocx(data);
    case 'xlsx':
      return parseXlsx(data);
  }
}
