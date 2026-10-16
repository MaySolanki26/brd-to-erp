import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { PermanentJobError } from '../errors.js';
import { assertZipWithinLimit } from './zip-guard.js';

const docx = readFileSync(new URL('../../test/fixtures/requirements.docx', import.meta.url));

/** Builds an archive that only has a central directory declaring the given sizes. */
function archiveDeclaring(sizes: number[]): Buffer {
  const entries = sizes.map((size, i) => {
    const name = Buffer.from(`part-${String(i)}.xml`);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt32LE(size, 24);
    header.writeUInt16LE(name.length, 28);
    return Buffer.concat([header, name]);
  });
  const directory = Buffer.concat(entries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(sizes.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([directory, eocd]);
}

describe('assertZipWithinLimit', () => {
  it('accepts a real Office file', () => {
    expect(() => assertZipWithinLimit(docx, 10 * 1024 * 1024)).not.toThrow();
  });

  it('rejects an archive that would expand beyond the limit', () => {
    const bomb = archiveDeclaring([400 * 1024 * 1024]);
    expect(() => assertZipWithinLimit(bomb, 200 * 1024 * 1024)).toThrow(/too large/);
  });

  it('adds up many small entries', () => {
    const many = archiveDeclaring(Array.from({ length: 5 }, () => 60 * 1024 * 1024));
    expect(() => assertZipWithinLimit(many, 200 * 1024 * 1024)).toThrow(PermanentJobError);
    expect(() => assertZipWithinLimit(many, 400 * 1024 * 1024)).not.toThrow();
  });

  it('rejects zip64 sizes as too large', () => {
    expect(() => assertZipWithinLimit(archiveDeclaring([0xffffffff]), 1e12)).toThrow(/too large/);
  });

  it('rejects data that is not an archive', () => {
    expect(() => assertZipWithinLimit(Buffer.from('plain text'), 1e9)).toThrow(/corrupt/);
    expect(() => assertZipWithinLimit(Buffer.alloc(0), 1e9)).toThrow(PermanentJobError);
  });
});
