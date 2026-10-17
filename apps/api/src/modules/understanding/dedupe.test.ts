import { describe, expect, it } from 'vitest';
import { questionDedupeKey } from './dedupe.js';
import { uuid } from './test-items.js';

const a = { kind: 'requirement', id: uuid() } as const;
const b = { kind: 'rule', id: uuid() } as const;

describe('questionDedupeKey', () => {
  it('is the same for the same gap, whatever the order or repeats of the linked items', () => {
    const key = questionDedupeKey({ reason: 'GAP', moduleId: null, linkedItems: [a, b] });
    expect(questionDedupeKey({ reason: 'GAP', moduleId: null, linkedItems: [b, a, a] })).toBe(key);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when the reason, the module or the items differ', () => {
    const base = questionDedupeKey({ reason: 'GAP', moduleId: null, linkedItems: [a] });
    expect(questionDedupeKey({ reason: 'AMBIGUITY', moduleId: null, linkedItems: [a] })).not.toBe(
      base,
    );
    expect(questionDedupeKey({ reason: 'GAP', moduleId: uuid(), linkedItems: [a] })).not.toBe(base);
    expect(questionDedupeKey({ reason: 'GAP', moduleId: null, linkedItems: [a, b] })).not.toBe(
      base,
    );
  });

  it('does not confuse an item kind with an id', () => {
    const id = uuid();
    expect(
      questionDedupeKey({ reason: 'GAP', moduleId: null, linkedItems: [{ kind: 'rule', id }] }),
    ).not.toBe(
      questionDedupeKey({
        reason: 'GAP',
        moduleId: null,
        linkedItems: [{ kind: 'requirement', id }],
      }),
    );
  });
});
