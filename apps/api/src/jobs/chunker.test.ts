import { describe, it, expect } from 'vitest';
import { MAX_CHUNK_CHARS, chunkSections } from './chunker.js';
import { PermanentJobError } from './errors.js';
import { MAX_EXTRACTED_CHARS } from './parsers/types.js';

describe('chunkSections', () => {
  it('keeps a short section as one chunk with its heading path', () => {
    const chunks = chunkSections('src1', [{ headingPath: ['A', 'B'], text: 'Short text' }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      headingPath: ['A', 'B'],
      content: 'Short text',
      tokenCount: 3,
    });
  });

  it('numbers chunks across sections in order', () => {
    const chunks = chunkSections('s', [
      { headingPath: ['A'], text: 'one' },
      { headingPath: ['B'], text: 'two' },
    ]);
    expect(chunks.map((c) => [c.chunkIndex, c.headingPath[0]])).toEqual([
      [0, 'A'],
      [1, 'B'],
    ]);
  });

  it('splits long sections on paragraph boundaries without exceeding the limit', () => {
    const paragraph = 'word '.repeat(300).trim();
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n');
    const chunks = chunkSections('s', [{ headingPath: ['Long'], text }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(chunk.headingPath).toEqual(['Long']);
    }
    expect(chunks.map((c) => c.content).join('\n\n')).toBe(text);
  });

  it('cuts a single huge paragraph at whitespace', () => {
    const chunks = chunkSections('s', [{ headingPath: [], text: 'abc '.repeat(3000).trim() }]);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.content.length <= MAX_CHUNK_CHARS)).toBe(true);
    expect(chunks.every((c) => !c.content.startsWith(' ') && !c.content.endsWith(' '))).toBe(true);
  });

  it('hard-cuts text that has no whitespace at all', () => {
    const chunks = chunkSections('s', [
      { headingPath: [], text: 'x'.repeat(MAX_CHUNK_CHARS * 2 + 5) },
    ]);
    expect(chunks.map((c) => c.content.length)).toEqual([MAX_CHUNK_CHARS, MAX_CHUNK_CHARS, 5]);
  });

  it('produces identical keys when run again on the same input', () => {
    const sections = [
      { headingPath: ['A'], text: 'alpha' },
      { headingPath: ['B'], text: 'beta' },
    ];
    expect(chunkSections('v1', sections)).toEqual(chunkSections('v1', sections));
  });

  it('gives different keys for another source, position or content', () => {
    const base = chunkSections('v1', [{ headingPath: [], text: 'same' }])[0];
    const otherSource = chunkSections('v2', [{ headingPath: [], text: 'same' }])[0];
    const otherText = chunkSections('v1', [{ headingPath: [], text: 'different' }])[0];
    expect(otherSource?.chunkKey).not.toBe(base?.chunkKey);
    expect(otherText?.chunkKey).not.toBe(base?.chunkKey);
    expect(otherSource?.contentHash).toBe(base?.contentHash);
  });

  it('drops empty sections', () => {
    expect(chunkSections('s', [{ headingPath: ['A'], text: '   ' }])).toEqual([]);
  });

  it('refuses sources beyond the extraction limit', () => {
    const huge = [{ headingPath: [], text: 'x'.repeat(MAX_EXTRACTED_CHARS + 1) }];
    expect(() => chunkSections('s', huge)).toThrow(PermanentJobError);
  });
});
