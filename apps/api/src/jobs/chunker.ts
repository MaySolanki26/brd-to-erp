import { createHash } from 'node:crypto';
import { MAX_EXTRACTED_CHARS, type ParsedSection } from './parsers/types.js';
import { PermanentJobError, TOO_LARGE } from './errors.js';

export const MAX_CHUNK_CHARS = 3_000;

/** Chunks whose text disappeared but still hold confirmed items are moved to indexes from here up. */
export const STALE_CHUNK_INDEX_BASE = 1_000_000;
const CHARS_PER_TOKEN = 4;

export interface ChunkInput {
  chunkIndex: number;
  headingPath: string[];
  content: string;
  contentHash: string;
  chunkKey: string;
  tokenCount: number;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Splits an over-long paragraph at whitespace, falling back to a hard cut. */
function splitLongParagraph(paragraph: string): string[] {
  const pieces: string[] = [];
  let rest = paragraph;
  while (rest.length > MAX_CHUNK_CHARS) {
    const window = rest.slice(0, MAX_CHUNK_CHARS);
    const cut = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
    const at = cut > MAX_CHUNK_CHARS / 2 ? cut : MAX_CHUNK_CHARS;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

function splitText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    for (const piece of splitLongParagraph(paragraph.trim())) {
      if (current && current.length + piece.length + 2 > MAX_CHUNK_CHARS) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Turns parsed sections into ordered chunks. The chunk key depends only on the source, the
 * position and the content, so re-running the same input yields the same keys.
 */
export function chunkSections(sourceId: string, sections: ParsedSection[]): ChunkInput[] {
  const total = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (total > MAX_EXTRACTED_CHARS) throw new PermanentJobError(TOO_LARGE);

  const chunks: ChunkInput[] = [];
  for (const section of sections) {
    for (const content of splitText(section.text.trim())) {
      if (!content) continue;
      const chunkIndex = chunks.length;
      const contentHash = sha256(content);
      chunks.push({
        chunkIndex,
        headingPath: section.headingPath,
        content,
        contentHash,
        chunkKey: sha256(`${sourceId}:${String(chunkIndex)}:${contentHash}`),
        tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN),
      });
    }
  }
  return chunks;
}
