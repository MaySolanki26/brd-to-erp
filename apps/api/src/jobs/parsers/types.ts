export interface ParsedSection {
  /** Headings from the document root down to this section. */
  headingPath: string[];
  text: string;
}

export const MAX_EXTRACTED_CHARS = 2_000_000;
export const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
