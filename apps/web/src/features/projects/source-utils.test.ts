import { describe, it, expect } from 'vitest';
import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { checkUploadable, formatBytes, mimeTypeFor } from './source-utils';

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

describe('mimeTypeFor', () => {
  it('derives the MIME type from the extension, ignoring case', () => {
    expect(mimeTypeFor('Spec.PDF')).toBe('application/pdf');
    expect(mimeTypeFor('a.docx')).toMatch(/wordprocessingml/);
    expect(mimeTypeFor('a.xlsx')).toMatch(/spreadsheetml/);
  });

  it('returns null for unsupported names', () => {
    expect(mimeTypeFor('notes.txt')).toBeNull();
    expect(mimeTypeFor('archive.pdf.exe')).toBeNull();
  });
});

describe('checkUploadable', () => {
  it('accepts supported files within the size limit', () => {
    expect(checkUploadable(file('a.pdf'))).toBeNull();
  });

  it('explains why a file cannot be uploaded', () => {
    expect(checkUploadable(file('a.txt'))).toMatch(/Unsupported file/);
    expect(checkUploadable(file('a.pdf', 0))).toMatch(/empty/);
    expect(checkUploadable({ name: 'a.pdf', size: MAX_UPLOAD_BYTES + 1 } as File)).toMatch(
      /larger than 25 MB/,
    );
  });
});

describe('formatBytes', () => {
  it('uses a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
