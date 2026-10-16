import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  NO_TEXT,
  OCR_NOT_SUPPORTED,
  PermanentJobError,
  TOO_LARGE,
  UNREADABLE_FILE,
} from '../errors.js';
import { MAX_EXTRACTED_CHARS, type ParsedSection } from './types.js';

const MAX_PAGES = 500;

function normalise(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parsePdf(data: Buffer): Promise<ParsedSection[]> {
  const task = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });

  let pdf;
  try {
    pdf = await task.promise;
  } catch {
    throw new PermanentJobError(UNREADABLE_FILE);
  }

  try {
    if (pdf.numPages > MAX_PAGES) throw new PermanentJobError(TOO_LARGE);

    const sections: ParsedSection[] = [];
    let totalChars = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalise(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join(''),
      );
      page.cleanup();
      totalChars += text.length;
      if (totalChars > MAX_EXTRACTED_CHARS) throw new PermanentJobError(TOO_LARGE);
      if (text) sections.push({ headingPath: [`Page ${String(pageNumber)}`], text });
    }

    if (sections.length === 0) {
      throw new PermanentJobError(pdf.numPages > 0 ? OCR_NOT_SUPPORTED : NO_TEXT);
    }
    return sections;
  } finally {
    await task.destroy();
  }
}
