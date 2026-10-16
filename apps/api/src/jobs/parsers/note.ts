import { NO_TEXT, PermanentJobError } from '../errors.js';
import { markdownSections } from './markdown.js';
import type { ParsedSection } from './types.js';

export function parseNote(title: string, body: string): ParsedSection[] {
  const sections = markdownSections(body, [title]);
  if (sections.length === 0) throw new PermanentJobError(NO_TEXT);
  return sections;
}
