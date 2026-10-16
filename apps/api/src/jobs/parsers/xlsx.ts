import ExcelJS from 'exceljs';
import { NO_TEXT, PermanentJobError, UNREADABLE_FILE } from '../errors.js';
import { assertZipWithinLimit } from './zip-guard.js';
import { MAX_UNCOMPRESSED_BYTES, type ParsedSection } from './types.js';

const MAX_SHEETS = 50;
const MAX_ROWS_PER_SHEET = 5_000;
const MAX_COLUMNS = 100;

function sheetText(sheet: ExcelJS.Worksheet): string {
  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS_PER_SHEET) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      if (columnNumber > MAX_COLUMNS) return;
      const text = cell.text.trim();
      if (text) cells.push(text);
    });
    if (cells.length > 0) lines.push(cells.join(' | '));
  });
  return lines.join('\n');
}

export async function parseXlsx(data: Buffer): Promise<ParsedSection[]> {
  assertZipWithinLimit(data, MAX_UNCOMPRESSED_BYTES);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  } catch {
    throw new PermanentJobError(UNREADABLE_FILE);
  }

  const sections: ParsedSection[] = [];
  for (const sheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
    const text = sheetText(sheet);
    if (text) sections.push({ headingPath: [sheet.name], text });
  }
  if (sections.length === 0) throw new PermanentJobError(NO_TEXT);
  return sections;
}
