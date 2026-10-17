import { describe, it, expect } from 'vitest';
import { groupQuestions } from './group-questions';
import { question } from './question-fixtures';

const mod = (id: string, name: string) => ({ id, name });

describe('groupQuestions', () => {
  it('returns nothing for no questions', () => {
    expect(groupQuestions([])).toEqual([]);
  });

  it('groups by module and puts questions without one under General, last', () => {
    const groups = groupQuestions([
      question({ id: 'a', module: null, priority: 'CRITICAL' }),
      question({ id: 'b', module: mod('m1', 'Finance'), priority: 'NORMAL' }),
      question({ id: 'c', module: mod('m1', 'Finance'), priority: 'HIGH' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Finance', 'General']);
    expect(groups[0]?.questions.map((q) => q.id)).toEqual(['c', 'b']);
  });

  it('sorts inside a group by priority, then oldest first', () => {
    const [group] = groupQuestions([
      question({ id: 'n-new', priority: 'NORMAL', createdAt: '2026-01-03T00:00:00Z' }),
      question({ id: 'h', priority: 'HIGH', createdAt: '2026-01-02T00:00:00Z' }),
      question({ id: 'n-old', priority: 'NORMAL', createdAt: '2026-01-01T00:00:00Z' }),
      question({ id: 'c', priority: 'CRITICAL', createdAt: '2026-01-04T00:00:00Z' }),
    ]);
    expect(group?.questions.map((q) => q.id)).toEqual(['c', 'h', 'n-old', 'n-new']);
  });

  it('orders groups by their most urgent question, then by name', () => {
    const groups = groupQuestions([
      question({ id: '1', module: mod('m1', 'Zebra'), priority: 'HIGH' }),
      question({ id: '2', module: mod('m2', 'Alpha'), priority: 'NORMAL' }),
      question({ id: '3', module: mod('m3', 'Beta'), priority: 'HIGH' }),
      question({ id: '4', module: mod('m4', 'Omega'), priority: 'CRITICAL' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Omega', 'Beta', 'Zebra', 'Alpha']);
  });

  it('keeps General last even when it holds the most urgent question', () => {
    const groups = groupQuestions([
      question({ id: '1', module: null, priority: 'CRITICAL' }),
      question({ id: '2', module: mod('m1', 'Finance'), priority: 'NORMAL' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['Finance', 'General']);
  });

  it('does not change the input', () => {
    const input = [
      question({ id: 'b', priority: 'NORMAL' }),
      question({ id: 'a', priority: 'CRITICAL' }),
    ];
    groupQuestions(input);
    expect(input.map((q) => q.id)).toEqual(['b', 'a']);
  });

  describe('with the server counts for every page', () => {
    it('reports the true size of each group, never less than what is loaded', () => {
      const groups = groupQuestions(
        [question({ id: 'a', module: mod('m1', 'Finance') })],
        [
          { moduleId: 'm1', total: 7, mostUrgent: 'NORMAL' },
          { moduleId: null, total: 2, mostUrgent: 'HIGH' },
        ],
      );
      expect(groups[0]?.total).toBe(7);
      const loadedMore = groupQuestions(
        [
          question({ id: 'a', module: mod('m1', 'Finance') }),
          question({ id: 'b', module: mod('m1', 'Finance') }),
        ],
        [{ moduleId: 'm1', total: 1, mostUrgent: 'NORMAL' }],
      );
      expect(loadedMore[0]?.total).toBe(2);
    });

    it('orders groups by the most urgent question in the whole result, not just the loaded part', () => {
      const groups = groupQuestions(
        [
          question({ id: '1', module: mod('m1', 'Alpha'), priority: 'NORMAL' }),
          question({ id: '2', module: mod('m2', 'Beta'), priority: 'NORMAL' }),
        ],
        [
          { moduleId: 'm1', total: 2, mostUrgent: 'NORMAL' },
          { moduleId: 'm2', total: 2, mostUrgent: 'CRITICAL' },
        ],
      );
      expect(groups.map((g) => g.title)).toEqual(['Beta', 'Alpha']);
    });

    it('falls back to the loaded questions when no counts are given', () => {
      const [group] = groupQuestions([question({ id: 'a' }), question({ id: 'b' })]);
      expect(group?.total).toBe(2);
    });
  });
});
