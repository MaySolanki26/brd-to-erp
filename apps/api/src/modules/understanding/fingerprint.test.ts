import { describe, expect, it } from 'vitest';
import { summaryFingerprint } from './fingerprint.js';
import { item } from './test-items.js';

describe('summaryFingerprint', () => {
  const a = item('requirement', 'CONFIRMED');
  const b = item('rule', 'OPEN');

  it('does not depend on the order of items', () => {
    expect(summaryFingerprint([a, b])).toBe(summaryFingerprint([b, a]));
  });

  it('changes when an item is added, removed, reworded or changes status or module', () => {
    const base = summaryFingerprint([a, b]);
    expect(summaryFingerprint([a])).not.toBe(base);
    expect(summaryFingerprint([a, b, item('module')])).not.toBe(base);
    expect(summaryFingerprint([a, { ...b, title: 'New title' }])).not.toBe(base);
    expect(summaryFingerprint([a, { ...b, description: 'New text' }])).not.toBe(base);
    expect(summaryFingerprint([a, { ...b, status: 'CONFIRMED' }])).not.toBe(base);
    expect(summaryFingerprint([a, { ...b, moduleId: 'm' }])).not.toBe(base);
  });

  it('is stable for identical input, including no items', () => {
    expect(summaryFingerprint([a, b])).toBe(summaryFingerprint([{ ...a }, { ...b }]));
    expect(summaryFingerprint([])).toBe(summaryFingerprint([]));
  });
});
