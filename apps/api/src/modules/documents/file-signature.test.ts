import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildPdf, buildXlsx } from '../../test/build-files.js';
import { matchesFileSignature } from './file-signature.js';

const docx = readFileSync(new URL('../../test/fixtures/requirements.docx', import.meta.url));

describe('matchesFileSignature', () => {
  it('accepts real files of each type', async () => {
    expect(matchesFileSignature('pdf', buildPdf(['x']))).toBe(true);
    expect(matchesFileSignature('docx', docx)).toBe(true);
    expect(matchesFileSignature('xlsx', await buildXlsx({ S: [['a']] }))).toBe(true);
  });

  it('rejects a file claiming the wrong type', async () => {
    const xlsx = await buildXlsx({ S: [['a']] });
    expect(matchesFileSignature('pdf', docx)).toBe(false);
    expect(matchesFileSignature('docx', xlsx)).toBe(false);
    expect(matchesFileSignature('xlsx', docx)).toBe(false);
    expect(matchesFileSignature('docx', buildPdf(['x']))).toBe(false);
  });

  it('rejects executables, empty files and bare zips', () => {
    expect(matchesFileSignature('pdf', Buffer.from('MZ\x90\x00'))).toBe(false);
    expect(matchesFileSignature('pdf', Buffer.alloc(0))).toBe(false);
    expect(matchesFileSignature('docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe(false);
  });

  it('requires the PDF header at the very start', () => {
    expect(matchesFileSignature('pdf', Buffer.from('junk%PDF-1.4'))).toBe(false);
  });
});
