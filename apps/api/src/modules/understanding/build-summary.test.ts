import { describe, expect, it } from 'vitest';
import type { SummaryLlmOutput } from '@brd/shared';
import { MAX_KEY_REQUIREMENTS, sanitizeSummary } from './build-summary.js';
import { item, uuid } from './test-items.js';

const mod = item('module', 'CONFIRMED', { title: 'Billing' });
const good = item('requirement', 'CONFIRMED', { title: 'Monthly run' });
const assumed = item('requirement', 'ASSUMED', {
  title: 'Refund window',
  description: 'Five days',
});
const stale = item('rule', 'NEEDS_REVALIDATION', { title: 'Old VAT rule' });
const rejected = item('requirement', 'REJECTED', { title: 'PDF export' });
const items = [mod, good, assumed, stale, rejected];

function output(over: Partial<SummaryLlmOutput> = {}): SummaryLlmOutput {
  return {
    overview: 'A billing system.',
    modules: [{ moduleId: mod.id, name: 'Wrong name from model', summary: 'Sends invoices.' }],
    keyRequirements: [{ requirementId: good.id, why: 'Core flow.' }],
    keyRules: [],
    assumptions: [],
    staleItems: [],
    ...over,
  };
}

describe('sanitizeSummary', () => {
  it('takes module names from the real items, not from the model', () => {
    const content = sanitizeSummary(output(), items);
    expect(content.modules).toEqual([
      { moduleId: mod.id, name: 'Billing', summary: 'Sends invoices.' },
    ]);
    expect(content.keyRequirements).toEqual([{ requirementId: good.id, why: 'Core flow.' }]);
  });

  it('drops ids that do not exist, wrong kinds, rejected and stale items from the key lists', () => {
    const content = sanitizeSummary(
      output({
        keyRequirements: [
          { requirementId: uuid(), why: 'invented' },
          { requirementId: rejected.id, why: 'ruled out' },
          { requirementId: mod.id, why: 'a module, not a requirement' },
          { requirementId: good.id, why: 'real' },
          { requirementId: good.id, why: 'repeated' },
        ],
        keyRules: [{ ruleId: stale.id, why: 'stale' }],
      }),
      items,
    );
    expect(content.keyRequirements.map((r) => r.requirementId)).toEqual([good.id]);
    expect(content.keyRules).toEqual([]);
  });

  it('lists every assumed item itself, using the model wording when it gave one', () => {
    const withNote = sanitizeSummary(
      output({
        assumptions: [
          { itemKind: 'requirement', itemId: assumed.id, statement: 'We assume 5 days.' },
        ],
      }),
      items,
    );
    expect(withNote.assumptions).toEqual([
      { itemKind: 'requirement', itemId: assumed.id, statement: 'We assume 5 days.' },
    ]);
    const without = sanitizeSummary(output(), items);
    expect(without.assumptions[0]?.statement).toBe('Five days');
  });

  it('computes the stale list from the data, ignoring what the model claims', () => {
    const content = sanitizeSummary(
      output({ staleItems: [{ itemKind: 'requirement', itemId: good.id }] }),
      items,
    );
    expect(content.staleItems).toEqual([{ itemKind: 'rule', itemId: stale.id }]);
  });

  it('leaves out rejected modules and caps the key lists', () => {
    const rejectedModule = item('module', 'REJECTED');
    const many = Array.from({ length: MAX_KEY_REQUIREMENTS + 4 }, () =>
      item('requirement', 'CONFIRMED'),
    );
    const content = sanitizeSummary(
      output({ keyRequirements: many.map((m) => ({ requirementId: m.id, why: 'x' })) }),
      [...items, rejectedModule, ...many],
    );
    expect(content.modules.map((m) => m.moduleId)).toEqual([mod.id]);
    expect(content.keyRequirements).toHaveLength(MAX_KEY_REQUIREMENTS);
  });

  it('tidies and limits free text', () => {
    const content = sanitizeSummary(output({ overview: `  ${'word '.repeat(500)}\n` }), items);
    expect(content.overview.length).toBeLessThanOrEqual(1000);
    expect(content.overview).not.toMatch(/\s{2}/);
  });
});
