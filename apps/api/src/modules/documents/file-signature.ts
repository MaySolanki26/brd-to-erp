import type { SourceFileType } from '@brd/shared';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function isZip(data: Buffer): boolean {
  return ZIP_MAGIC.every((byte, i) => data[i] === byte);
}

/**
 * Checks the real bytes against the type the client claimed. Office files are zip archives,
 * so the member names stored inside tell a .docx from a .xlsx or an arbitrary zip.
 */
export function matchesFileSignature(type: SourceFileType, data: Buffer): boolean {
  switch (type) {
    case 'pdf':
      return data.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'docx':
      return isZip(data) && data.includes('word/document.xml');
    case 'xlsx':
      return isZip(data) && data.includes('xl/workbook.xml');
  }
}
