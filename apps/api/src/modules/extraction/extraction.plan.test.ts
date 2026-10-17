import { describe, expect, it } from 'vitest';
import type { ExtractionLlmOutput } from '@brd/shared';
import {
  MAX_ITEMS_PER_CHUNK,
  MAX_MODULES_PER_CHUNK,
  isEmptyPlan,
  normalize,
  planExtraction,
  sanitizeDrafts,
} from './extraction.plan.js';
import type { ExistingItem, ExtractedKind } from './extraction.types.js';

const answer = (overrides: Partial<ExtractionLlmOutput> = {}): ExtractionLlmOutput => ({
  modules: [],
  requirements: [],
  rules: [],
  ...overrides,
});

function existing(
  partial: Partial<ExistingItem> & Pick<ExistingItem, 'kind' | 'id' | 'title'>,
): ExistingItem {
  return {
    description: 'Old wording.',
    status: 'OPEN',
    createdById: null,
    moduleId: null,
    ownedHere: false,
    linkedHere: false,
    otherSourceChunkIds: [],
    ...partial,
  };
}

const none: Record<ExtractedKind, ExistingItem[]> = { module: [], requirement: [], rule: [] };
const stored = (...items: ExistingItem[]): Record<ExtractedKind, ExistingItem[]> => ({
  module: items.filter((i) => i.kind === 'module'),
  requirement: items.filter((i) => i.kind === 'requirement'),
  rule: items.filter((i) => i.kind === 'rule'),
});

describe('normalize', () => {
  it('ignores case and spacing only', () => {
    expect(normalize('  Send   Invoices ')).toBe('send invoices');
    expect(normalize('Send invoice')).not.toBe(normalize('Send invoices'));
  });
});

describe('sanitizeDrafts', () => {
  it('trims, drops empty and repeated titles, and keeps the first wording', () => {
    const drafts = sanitizeDrafts(
      answer({
        requirements: [
          { title: '  Send   invoices ', description: ' Within 3 days. ', moduleName: null },
          { title: 'send invoices', description: 'Same thing again.', moduleName: null },
          { title: '   ', description: 'No title.', moduleName: null },
        ],
      }),
    );
    expect(drafts.requirements).toEqual([
      { title: 'Send invoices', description: 'Within 3 days.', moduleName: null },
    ]);
  });

  it('caps each list', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        title: `T${String(i)}`,
        description: 'x',
        moduleName: null,
      }));
    const drafts = sanitizeDrafts(
      answer({
        modules: Array.from({ length: 30 }, (_, i) => ({ name: `M${String(i)}`, description: '' })),
        requirements: many(50),
        rules: many(50),
      }),
    );
    expect(drafts.modules).toHaveLength(MAX_MODULES_PER_CHUNK);
    expect(drafts.requirements).toHaveLength(MAX_ITEMS_PER_CHUNK);
    expect(drafts.rules).toHaveLength(MAX_ITEMS_PER_CHUNK);
  });

  it('keeps a module name only when the answer lists that module', () => {
    const drafts = sanitizeDrafts(
      answer({
        modules: [{ name: 'Billing', description: 'Invoices.' }],
        requirements: [
          { title: 'A', description: '', moduleName: ' billing ' },
          { title: 'B', description: '', moduleName: 'Made-up module' },
          { title: 'C', description: '', moduleName: null },
        ],
      }),
    );
    expect(drafts.requirements.map((r) => r.moduleName)).toEqual(['billing', null, null]);
  });
});

describe('planExtraction', () => {
  const drafts = sanitizeDrafts(
    answer({
      modules: [{ name: 'Billing', description: 'Invoices.' }],
      requirements: [
        { title: 'Send invoices', description: 'Within 3 days.', moduleName: 'Billing' },
      ],
      rules: [{ title: 'VAT is 20%', description: 'On every invoice.', moduleName: 'Billing' }],
    }),
  );

  it('creates everything in an empty project', () => {
    const plan = planExtraction(drafts, none);
    expect(plan.create.map((c) => [c.kind, c.title])).toEqual([
      ['module', 'Billing'],
      ['requirement', 'Send invoices'],
      ['rule', 'VAT is 20%'],
    ]);
    expect(plan.link).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('adds this chunk as another source instead of duplicating an item found elsewhere', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({ kind: 'requirement', id: 'r1', title: 'SEND INVOICES' }),
        existing({ kind: 'module', id: 'm1', title: 'billing' }),
      ),
    );
    expect(plan.create.map((c) => c.title)).toEqual(['VAT is 20%']);
    expect(plan.link).toEqual([
      { kind: 'module', id: 'm1' },
      { kind: 'requirement', id: 'r1' },
    ]);
  });

  it('brings a stale item back to OPEN when the new text states it again, and leaves others alone', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'Send invoices',
          status: 'NEEDS_REVALIDATION',
        }),
        existing({ kind: 'rule', id: 'u1', title: 'VAT is 20%', status: 'CONFIRMED' }),
        existing({
          kind: 'module',
          id: 'm9',
          title: 'Gone from the text',
          status: 'NEEDS_REVALIDATION',
        }),
      ),
    );
    expect(plan.revalidate).toEqual([{ kind: 'requirement', id: 'r1' }]);
  });

  it('plans nothing more once the stale item is back to OPEN and linked (a retried job)', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'Send invoices',
          description: 'Within 3 days.',
          linkedHere: true,
        }),
      ),
    );
    expect(plan.revalidate).toEqual([]);
  });

  it('does nothing when the chunk already owns or links the matching item', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({
          kind: 'module',
          id: 'm1',
          title: 'Billing',
          description: 'Invoices.',
          ownedHere: true,
        }),
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'Send invoices',
          description: 'Within 3 days.',
          ownedHere: true,
          moduleId: 'm1',
        }),
        existing({
          kind: 'rule',
          id: 'u1',
          title: 'VAT is 20%',
          description: 'On every invoice.',
          linkedHere: true,
          moduleId: 'm1',
        }),
      ),
    );
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('refreshes the wording of an unconfirmed item this chunk owns, and fills a missing module', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({ kind: 'requirement', id: 'r1', title: 'Send invoices', ownedHere: true }),
        existing({
          kind: 'rule',
          id: 'u1',
          title: 'VAT is 20%',
          description: 'On every invoice.',
          ownedHere: true,
        }),
      ),
    );
    expect(plan.update).toEqual([
      { kind: 'requirement', id: 'r1', description: 'Within 3 days.', moduleName: 'Billing' },
      { kind: 'rule', id: 'u1', moduleName: 'Billing' },
    ]);
  });

  it('never rewrites a confirmed item or one a person made', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'Send invoices',
          status: 'CONFIRMED',
          ownedHere: true,
        }),
        existing({
          kind: 'rule',
          id: 'u1',
          title: 'VAT is 20%',
          createdById: 'user-1',
          ownedHere: true,
        }),
      ),
    );
    expect(plan.update).toEqual([]);
  });

  it('removes unconfirmed items the chunk no longer states, or moves them to another chunk that does', () => {
    const plan = planExtraction(
      sanitizeDrafts(answer()),
      stored(
        existing({ kind: 'requirement', id: 'r1', title: 'Gone', ownedHere: true }),
        existing({
          kind: 'rule',
          id: 'u1',
          title: 'Also elsewhere',
          ownedHere: true,
          otherSourceChunkIds: ['c9', 'c10'],
        }),
      ),
    );
    expect(plan.remove).toEqual([
      { kind: 'requirement', id: 'r1', repointTo: null },
      { kind: 'rule', id: 'u1', repointTo: 'c9' },
    ]);
  });

  it('keeps confirmed, flagged and person-made items that are no longer stated', () => {
    const plan = planExtraction(
      sanitizeDrafts(answer()),
      stored(
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'A',
          status: 'CONFIRMED',
          ownedHere: true,
        }),
        existing({
          kind: 'requirement',
          id: 'r2',
          title: 'B',
          status: 'NEEDS_REVALIDATION',
          ownedHere: true,
        }),
        existing({ kind: 'rule', id: 'u1', title: 'C', createdById: 'user-1', ownedHere: true }),
      ),
    );
    expect(plan.remove).toEqual([]);
  });

  it('drops the link to an item the chunk no longer states', () => {
    const plan = planExtraction(
      sanitizeDrafts(answer()),
      stored(existing({ kind: 'requirement', id: 'r1', title: 'A', linkedHere: true })),
    );
    expect(plan.unlink).toEqual([{ kind: 'requirement', id: 'r1' }]);
    expect(plan.remove).toEqual([]);
  });

  it('adds a source to a flagged item when the new version states it again, without changing its status', () => {
    const plan = planExtraction(
      drafts,
      stored(
        existing({
          kind: 'requirement',
          id: 'r1',
          title: 'Send invoices',
          status: 'NEEDS_REVALIDATION',
        }),
      ),
    );
    expect(plan.link).toContainEqual({ kind: 'requirement', id: 'r1' });
    expect(plan.update).toEqual([]);
    expect(plan.create.map((c) => c.title)).not.toContain('Send invoices');
  });
});
