import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildPdf, buildXlsx } from '../../test/build-files.js';
import { PermanentJobError } from '../errors.js';
import { htmlToMarkdown } from './docx.js';
import { fileTypeFromMime, parseFile, parseNote } from './index.js';
import { markdownSections } from './markdown.js';

const docx = readFileSync(new URL('../../test/fixtures/requirements.docx', import.meta.url));

describe('pdf parser', () => {
  it('returns one section per page with extracted text', async () => {
    const sections = await parseFile(
      'pdf',
      buildPdf(['Invoices follow delivery.', 'Payment is due in 30 days.']),
    );
    expect(sections).toEqual([
      { headingPath: ['Page 1'], text: 'Invoices follow delivery.' },
      { headingPath: ['Page 2'], text: 'Payment is due in 30 days.' },
    ]);
  });

  it('skips blank pages but keeps page numbers', async () => {
    const sections = await parseFile('pdf', buildPdf(['First', '', 'Third']));
    expect(sections.map((s) => s.headingPath[0])).toEqual(['Page 1', 'Page 3']);
  });

  it('fails permanently with the OCR message when no page has text', async () => {
    const error = await parseFile('pdf', buildPdf(['', ''])).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PermanentJobError);
    expect((error as Error).message).toMatch(/^OCR not supported/);
  });

  it('fails permanently on corrupt input instead of crashing', async () => {
    const error = await parseFile('pdf', Buffer.from('%PDF-1.4 definitely not valid')).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PermanentJobError);
    expect((error as Error).message).toMatch(/corrupt or password-protected/);
  });
});

describe('docx parser', () => {
  it('builds sections that carry the heading hierarchy', async () => {
    const sections = await parseFile('docx', docx);
    expect(sections.map((s) => s.headingPath)).toEqual([
      ['Order to Cash'],
      ['Order to Cash', 'Invoicing'],
      ['Order to Cash', 'Collections'],
      ['Procure to Pay'],
    ]);
    expect(sections[0]?.text).toBe(
      'The business invoices customers after delivery & collects payment within 30 days.',
    );
  });

  it('fails permanently on a file that is not a real archive', async () => {
    await expect(parseFile('docx', Buffer.from('not a zip at all'))).rejects.toBeInstanceOf(
      PermanentJobError,
    );
  });
});

describe('htmlToMarkdown', () => {
  it('turns headings, paragraphs, lists and tables into lines', () => {
    const md = htmlToMarkdown(
      '<h1>Scope</h1><p>One &amp; two</p><ul><li>a</li><li>b</li></ul>' +
        '<table><tr><td>ID</td><td>Rule</td></tr><tr><td>R1</td><td>x &lt; y</td></tr></table>',
    );
    expect(md).toContain('# Scope');
    expect(md).toContain('One & two');
    expect(md).toContain('a\nb');
    expect(md).toContain('ID | Rule');
    expect(md).toContain('R1 | x < y');
  });

  it('strips tags and never leaves markup behind', () => {
    expect(htmlToMarkdown('<h2><strong>Bold</strong> head</h2><p><a href="x">link</a></p>')).toBe(
      '\n\n## Bold head\n\nlink\n',
    );
  });
});

describe('xlsx parser', () => {
  it('returns one section per sheet with rows joined by separators', async () => {
    const data = await buildXlsx({
      Rules: [
        ['ID', 'Rule'],
        ['R1', 'Approve above 10k'],
      ],
      Empty: [],
      Modules: [['Finance']],
    });
    expect(await parseFile('xlsx', data)).toEqual([
      { headingPath: ['Rules'], text: 'ID | Rule\nR1 | Approve above 10k' },
      { headingPath: ['Modules'], text: 'Finance' },
    ]);
  });

  it('fails permanently when every sheet is empty', async () => {
    await expect(parseFile('xlsx', await buildXlsx({ A: [] }))).rejects.toThrow(/No text found/);
  });

  it('fails permanently on corrupt input', async () => {
    await expect(parseFile('xlsx', Buffer.from('garbage'))).rejects.toBeInstanceOf(
      PermanentJobError,
    );
  });
});

describe('notes and markdown', () => {
  it('prefixes note sections with the note title', () => {
    expect(parseNote('Kickoff', '# Goals\nCut errors.\n\n# Risks\nBad data.')).toEqual([
      { headingPath: ['Kickoff', 'Goals'], text: 'Cut errors.' },
      { headingPath: ['Kickoff', 'Risks'], text: 'Bad data.' },
    ]);
  });

  it('keeps text that appears before the first heading', () => {
    const sections = markdownSections('Intro line\n\n# H\nBody');
    expect(sections[0]).toEqual({ headingPath: [], text: 'Intro line' });
  });

  it('pops sibling and deeper headings correctly', () => {
    const sections = markdownSections('# A\na\n## B\nb\n### C\nc\n## D\nd\n# E\ne');
    expect(sections.map((s) => s.headingPath.join(' > '))).toEqual([
      'A',
      'A > B',
      'A > B > C',
      'A > D',
      'E',
    ]);
  });

  it('cleans emphasis, escapes and anchors out of headings', () => {
    const [section] = markdownSections('# <a id="x"></a>**Order\\.** to _Cash_\nbody');
    expect(section?.headingPath).toEqual(['Order. to Cash']);
  });

  it('fails permanently for an empty note', () => {
    expect(() => parseNote('T', '  \n ')).toThrow(PermanentJobError);
  });
});

describe('fileTypeFromMime', () => {
  it('maps supported MIME types and rejects the rest', () => {
    expect(fileTypeFromMime('application/pdf')).toBe('pdf');
    expect(fileTypeFromMime('text/plain')).toBeNull();
  });
});
