import mammoth from 'mammoth';
import { NO_TEXT, PermanentJobError, UNREADABLE_FILE } from '../errors.js';
import { markdownSections } from './markdown.js';
import { assertZipWithinLimit } from './zip-guard.js';
import { MAX_UNCOMPRESSED_BYTES, type ParsedSection } from './types.js';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => ENTITIES[match] ?? match);
}

/**
 * mammoth emits clean, flat HTML. Turn headings into markdown headings and keep table rows and
 * list items on their own lines, so the text splits into sections the same way markdown does.
 */
export function htmlToMarkdown(html: string): string {
  const withBlocks = html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
      const title = inner.replace(/<[^>]*>/g, '').trim();
      return `\n\n${'#'.repeat(Number(level))} ${title}\n\n`;
    })
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<\/(p|li|tr|table|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(withBlocks)
    .replace(/ \| \n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

export async function parseDocx(data: Buffer): Promise<ParsedSection[]> {
  assertZipWithinLimit(data, MAX_UNCOMPRESSED_BYTES);

  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: data })).value;
  } catch {
    throw new PermanentJobError(UNREADABLE_FILE);
  }

  const sections = markdownSections(htmlToMarkdown(html));
  if (sections.length === 0) throw new PermanentJobError(NO_TEXT);
  return sections;
}
