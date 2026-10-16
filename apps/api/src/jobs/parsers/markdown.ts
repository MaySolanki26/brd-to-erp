import type { ParsedSection } from './types.js';

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function cleanHeading(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\\(.)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
}

/** Splits markdown into sections, each carrying the heading path above it. */
export function markdownSections(markdown: string, root: string[] = []): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (text) {
      sections.push({ headingPath: [...root, ...stack.map((h) => h.title)], text });
    }
    buffer = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    const match = HEADING.exec(line);
    const hashes = match?.[1];
    const title = match?.[2] === undefined ? '' : cleanHeading(match[2]);
    if (hashes && title) {
      flush();
      while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= hashes.length) {
        stack.pop();
      }
      stack.push({ level: hashes.length, title });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}
