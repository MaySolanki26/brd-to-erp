import ExcelJS from 'exceljs';

/** Builds a minimal one-page PDF. With no text it models a scanned PDF (graphics only). */
export function buildPdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body);

  add('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, i) => `${String(4 + i * 2)} 0 R`).join(' ');
  add(`<< /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pages.forEach((text, i) => {
    const contentId = 5 + i * 2;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${String(contentId)} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    const stream = text
      ? `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
      : '0 0 100 100 re f';
    add(`<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export async function buildXlsx(sheets: Record<string, string[][]>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    for (const row of rows) sheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
