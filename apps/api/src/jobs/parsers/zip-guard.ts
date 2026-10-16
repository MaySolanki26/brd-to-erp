import { PermanentJobError, TOO_LARGE, UNREADABLE_FILE } from '../errors.js';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_ENTRY_SIGNATURE = 0x02014b50;
const ZIP64_MARKER = 0xffffffff;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

function findEndOfCentralDirectory(data: Buffer): number {
  const lowest = Math.max(0, data.length - EOCD_MIN_SIZE - MAX_COMMENT);
  for (let pos = data.length - EOCD_MIN_SIZE; pos >= lowest; pos -= 1) {
    if (data.readUInt32LE(pos) === EOCD_SIGNATURE) return pos;
  }
  return -1;
}

/**
 * Office files are zip archives. Reads the central directory (without inflating anything) and
 * rejects archives that would expand beyond maxBytes, so a zip bomb never reaches a parser.
 */
export function assertZipWithinLimit(data: Buffer, maxBytes: number): void {
  const eocd = findEndOfCentralDirectory(data);
  if (eocd === -1) throw new PermanentJobError(UNREADABLE_FILE);

  const entryCount = data.readUInt16LE(eocd + 10);
  let pos = data.readUInt32LE(eocd + 16);
  let total = 0;

  for (let i = 0; i < entryCount; i += 1) {
    if (pos + 46 > data.length || data.readUInt32LE(pos) !== CENTRAL_ENTRY_SIGNATURE) {
      throw new PermanentJobError(UNREADABLE_FILE);
    }
    const size = data.readUInt32LE(pos + 24);
    if (size === ZIP64_MARKER) throw new PermanentJobError(TOO_LARGE);
    total += size;
    if (total > maxBytes) throw new PermanentJobError(TOO_LARGE);
    pos +=
      46 + data.readUInt16LE(pos + 28) + data.readUInt16LE(pos + 30) + data.readUInt16LE(pos + 32);
  }
}
