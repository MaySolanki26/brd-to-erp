import type { Readable } from 'node:stream';
import { ValidationError } from '../../errors/app-error.js';

/** Reads a stream fully into memory, aborting as soon as it exceeds maxBytes. */
export async function readStream(stream: Readable, maxBytes: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const part of stream) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new ValidationError('File is too large');
    }
    parts.push(buffer);
  }
  return Buffer.concat(parts);
}
