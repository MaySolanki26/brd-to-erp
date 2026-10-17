import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

import { toDecisionDto } from './decisions.service.js';

const ID = '11111111-1111-4111-8111-111111111111';
const base = {
  id: 'd1',
  summary: 'Decided.',
  createdAt: new Date('2026-03-01T10:00:00Z'),
  decidedBy: { id: 'u1', name: 'Ann' },
  question: { id: 'q1', content: 'Q?' },
  answer: { content: 'A.' },
};

describe('toDecisionDto', () => {
  it('turns a stored record into the timeline shape', () => {
    expect(toDecisionDto({ ...base, changes: [], conflicts: [] })).toEqual({
      id: 'd1',
      question: { id: 'q1', text: 'Q?' },
      answer: 'A.',
      summary: 'Decided.',
      decidedBy: { id: 'u1', name: 'Ann' },
      decidedAt: '2026-03-01T10:00:00.000Z',
      changes: [],
      conflicts: [],
    });
  });

  it('uses the new title for the item and keeps both states', () => {
    const dto = toDecisionDto({
      ...base,
      changes: [
        {
          kind: 'module',
          id: ID,
          before: { status: 'OPEN', title: 'Old', description: 'd1' },
          after: { status: 'CONFIRMED', title: 'New', description: 'd2' },
          reason: 'Settled',
        },
      ],
      conflicts: [],
    });
    expect(dto.changes[0]).toMatchObject({
      title: 'New',
      before: { title: 'Old' },
      after: { status: 'CONFIRMED' },
      reason: 'Settled',
    });
  });

  it('keeps valid entries and drops the rest', () => {
    const valid = {
      kind: 'rule',
      id: ID,
      before: { status: 'OPEN', title: 'R', description: null },
      after: { status: 'OPEN', title: 'R', description: null },
    };
    const dto = toDecisionDto({
      ...base,
      changes: [valid, { kind: 'rule' }, null, 7],
      conflicts: 'x',
    });
    expect(dto.changes).toHaveLength(1);
    expect(dto.conflicts).toEqual([]);
  });
});
