import { wrap } from '../understanding/prompt-inputs.js';
import type { ChunkToExtract } from './extraction.repository.js';

/** A chunk is at most a few paragraphs (see the chunker); this guards against an oversized outlier. */
export const MAX_PROMPT_CHUNK_CHARS = 6000;

/**
 * The whole variable input: the heading path and the text of one chunk, nothing else. There is no
 * project summary here, so the same chunk always produces the same input and recorded answers
 * (fixtures) stay valid whenever the extraction runs.
 */
export function extractionInput(chunk: Pick<ChunkToExtract, 'headingPath' | 'content'>): string {
  return wrap({
    section: chunk.headingPath,
    text: chunk.content.length > MAX_PROMPT_CHUNK_CHARS ? chunk.content.slice(0, MAX_PROMPT_CHUNK_CHARS) : chunk.content,
  });
}
