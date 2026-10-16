/** A failure retrying cannot fix. The message is safe to show to users. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export const UNREADABLE_FILE = 'Could not read this file. It may be corrupt or password-protected.';
export const TOO_LARGE = 'Source too large to process.';
export const NO_TEXT = 'No text found in this file.';
export const OCR_NOT_SUPPORTED = 'OCR not supported. This PDF has no selectable text.';
