import { describe, expect, it } from 'vitest';
import { buildBaseline, fingerprintItems } from './report.baseline.js';
import { buildReportContent, sanitizeNarrative } from './report.content.js';
import type { ReportItem } from './report.types.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (n: number, extra: Partial<ReportItem> = {}): ReportItem => ({
  kind: 'requirement',
  id: id(n),
  title: `Item ${String(n)}`,
  description: 'Text',
  status: 'OPEN',
  moduleId: null,
  moduleName: null,
  sourceChunkId: id(900),
  code: null,
  ...extra,
});

describe('fingerprintItems', () => {
  it('does not depend on the order items arrive in', () => {
    expect(fingerprintItems([item(1), item(2)])).toBe(fingerprintItems([item(2), item(1)]));
  });

  it.each([
    ['a new item', [item(1), item(2)]],
    ['a removed item', []],
    ['a changed status', [item(1, { status: 'CONFIRMED' })]],
    ['a changed title', [item(1, { title: 'Other' })]],
    ['a changed description', [item(1, { description: 'Other' })]],
  ])('changes with %s', (_name, changed) => {
    expect(fingerprintItems(changed)).not.toBe(fingerprintItems([item(1)]));
  });
});

describe('buildBaseline', () => {
  const sources = { documents: [], notes: [] };
  const make = (items: ReportItem[]) =>
    buildBaseline({
      takenAt: new Date('2026-10-17T10:00:00Z'),
      summaryVersion: 3,
      items,
      sources,
      openQuestions: { total: 2, critical: 0 },
    });

  it('is repeatable and records the items fingerprint', () => {
    const a = make([item(1)]);
    expect(make([item(1)]).hash).toBe(a.hash);
    expect(a.fingerprint).toBe(fingerprintItems([item(1)]));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes its hash when any item changes', () => {
    expect(make([item(1, { status: 'CONFIRMED' })]).hash).not.toBe(make([item(1)]).hash);
  });
});

describe('sanitizeNarrative', () => {
  it('trims, caps and drops empty lines', () => {
    const out = sanitizeNarrative({
      objectives: ['  Invoice   customers ', '', 'x'.repeat(900)],
      scope: { inScope: [' a '], outOfScope: [''] },
      roles: [
        { name: ' ', description: 'ignored' },
        { name: 'Clerk', description: ' Enters data ' },
      ],
      risks: [{ title: 'Tax', description: 'd', severity: 'HIGH' }],
      confidence: ' Fine. ',
    });
    expect(out.objectives).toHaveLength(2);
    expect(out.objectives[0]).toBe('Invoice customers');
    expect(out.objectives[1]).toHaveLength(500);
    expect(out.scope).toEqual({ inScope: ['a'], outOfScope: [] });
    expect(out.roles).toEqual([{ name: 'Clerk', description: 'Enters data' }]);
    expect(out.confidence).toBe('Fine.');
  });
});

describe('buildReportContent', () => {
  const narrative = sanitizeNarrative({
    objectives: [],
    scope: { inScope: [], outOfScope: [] },
    roles: [],
    risks: [],
    confidence: '',
  });

  it('lists every item the project has, whatever the model wrote', () => {
    const items = [
      item(1, { kind: 'module', title: 'Billing', code: 'BIL' }),
      item(2, { moduleName: 'Billing', status: 'CONFIRMED' }),
      item(3, { kind: 'rule', status: 'REJECTED' }),
    ];
    const content = buildReportContent({
      projectName: 'Acme',
      summary: {
        version: 2,
        content: {
          overview: 'o',
          modules: [],
          keyRequirements: [],
          keyRules: [],
          assumptions: [
            { itemKind: 'requirement', itemId: id(2), statement: 'Assumed so' },
            { itemKind: 'requirement', itemId: id(77), statement: 'Item no longer exists' },
          ],
          staleItems: [],
        },
      },
      items,
      openQuestions: { total: 0, items: [] },
      narrative,
    });
    expect(content.modules).toEqual([expect.objectContaining({ name: 'Billing', code: 'BIL' })]);
    expect(content.requirements).toHaveLength(1);
    expect(content.rules).toEqual([expect.objectContaining({ status: 'REJECTED' })]);
    expect(content.counts.requirements['CONFIRMED']).toBe(1);
    expect(content.assumptions).toEqual([
      { kind: 'requirement', id: id(2), title: 'Item 2', statement: 'Assumed so' },
    ]);
    expect(content.summaryVersion).toBe(2);
  });
});
