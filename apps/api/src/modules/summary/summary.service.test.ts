import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../../services/queue.service.js', () => ({ enqueueJob: vi.fn() }));

import { toSummaryContent } from './summary.service.js';

const REQ = '11111111-1111-4111-8111-111111111111';
const RULE = '22222222-2222-4222-8222-222222222222';
const MOD = '33333333-3333-4333-8333-333333333333';

describe('toSummaryContent', () => {
  const stored = {
    overview: 'Overview.',
    modules: [{ moduleId: MOD, name: 'Finance', summary: 'Money.' }],
    keyRequirements: [{ requirementId: REQ, why: 'Core.' }],
    keyRules: [{ ruleId: RULE, why: 'Controls.' }],
    assumptions: [{ itemKind: 'module' as const, itemId: MOD, statement: 'Assumed.' }],
    staleItems: [{ itemKind: 'rule' as const, itemId: RULE }],
  };

  it('attaches live titles for every kind of reference', () => {
    const titles = new Map([
      [`requirement:${REQ}`, 'Approve invoices'],
      [`rule:${RULE}`, 'Limit 10k'],
      [`module:${MOD}`, 'Finance (renamed)'],
    ]);
    expect(toSummaryContent(stored, titles)).toEqual({
      overview: 'Overview.',
      modules: [{ id: MOD, name: 'Finance', summary: 'Money.' }],
      keyRequirements: [{ id: REQ, title: 'Approve invoices', why: 'Core.' }],
      keyRules: [{ id: RULE, title: 'Limit 10k', why: 'Controls.' }],
      assumptions: [{ kind: 'module', id: MOD, title: 'Finance (renamed)', statement: 'Assumed.' }],
      staleItems: [{ kind: 'rule', id: RULE, title: 'Limit 10k' }],
    });
  });

  it('drops references whose item is gone', () => {
    const content = toSummaryContent(stored, new Map());
    expect(content.keyRequirements).toEqual([]);
    expect(content.keyRules).toEqual([]);
    expect(content.assumptions).toEqual([]);
    expect(content.staleItems).toEqual([]);
    expect(content.modules).toHaveLength(1);
  });
});
