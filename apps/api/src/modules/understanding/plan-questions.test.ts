import { describe, expect, it } from 'vitest';
import type { GeneratedQuestion } from '@brd/shared';
import { questionDedupeKey } from './dedupe.js';
import { MAX_QUESTIONS_PER_RUN, planQuestions } from './plan-questions.js';
import { item, uuid } from './test-items.js';

const moduleItem = item('module');
const req = item('requirement', 'OPEN', { moduleId: moduleItem.id });
const rule = item('rule', 'ASSUMED', { moduleId: moduleItem.id });
const rejected = item('requirement', 'REJECTED');
const items = [moduleItem, req, rule, rejected];
const modules = new Set([moduleItem.id]);

function q(over: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    reason: 'GAP',
    priority: 'NORMAL',
    text: 'What happens when payment fails?',
    moduleId: null,
    linkedItems: [{ kind: 'requirement', id: req.id }],
    ...over,
  };
}

describe('planQuestions', () => {
  it('keeps a valid question, tidies its text and takes the module from its items', () => {
    const { questions } = planQuestions(
      [q({ text: '  What   happens\nnow?  ' })],
      items,
      modules,
      new Set(),
    );
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      text: 'What happens now?',
      moduleId: moduleItem.id,
      linkedItems: [{ kind: 'requirement', id: req.id }],
    });
    expect(questions[0]?.dedupeKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores items the model invented and drops the question when none are real', () => {
    const plan = planQuestions(
      [
        q({ linkedItems: [{ kind: 'requirement', id: uuid() }] }),
        q({
          text: 'Real one with a fake extra',
          linkedItems: [
            { kind: 'requirement', id: req.id },
            { kind: 'rule', id: uuid() },
          ],
        }),
      ],
      items,
      modules,
      new Set(),
    );
    expect(plan.dropped.noValidItems).toBe(1);
    expect(plan.questions).toHaveLength(1);
    expect(plan.questions[0]?.linkedItems).toEqual([{ kind: 'requirement', id: req.id }]);
  });

  it('does not match an id under the wrong kind', () => {
    const plan = planQuestions(
      [q({ linkedItems: [{ kind: 'rule', id: req.id }] })],
      items,
      modules,
      new Set(),
    );
    expect(plan.questions).toEqual([]);
  });

  it('does not ask about rejected items', () => {
    const plan = planQuestions(
      [q({ linkedItems: [{ kind: 'requirement', id: rejected.id }] })],
      items,
      modules,
      new Set(),
    );
    expect(plan.dropped.noValidItems).toBe(1);
  });

  it('ignores a module that is not in the project', () => {
    const lonely = item('requirement');
    const plan = planQuestions(
      [q({ moduleId: uuid(), linkedItems: [{ kind: 'requirement', id: lonely.id }] })],
      [...items, lonely],
      modules,
      new Set(),
    );
    expect(plan.questions[0]?.moduleId).toBeNull();
  });

  it('skips a gap that was already asked, whatever its state, and one repeated in the same answer', () => {
    const existing = questionDedupeKey({
      reason: 'GAP',
      moduleId: moduleItem.id,
      linkedItems: [{ kind: 'requirement', id: req.id }],
    });
    const asked = planQuestions([q()], items, modules, new Set([existing]));
    expect(asked.questions).toEqual([]);
    expect(asked.dropped.duplicate).toBe(1);

    const repeated = planQuestions(
      [q(), q({ text: 'Reworded: what if payment fails?' })],
      items,
      modules,
      new Set(),
    );
    expect(repeated.questions).toHaveLength(1);
    expect(repeated.dropped.duplicate).toBe(1);
  });

  it('treats the same items with another reason as a different gap', () => {
    const plan = planQuestions([q(), q({ reason: 'MISSING_RULE' })], items, modules, new Set());
    expect(plan.questions.map((x) => x.reason)).toEqual(['GAP', 'MISSING_RULE']);
  });

  it('drops empty questions', () => {
    const plan = planQuestions([q({ text: '   ' })], items, modules, new Set());
    expect(plan.dropped.emptyText).toBe(1);
  });

  it('keeps the most urgent when over the limit', () => {
    const many = Array.from({ length: MAX_QUESTIONS_PER_RUN + 5 }, () => item('requirement'));
    const generated = many.map((m, i) =>
      q({
        priority: i === many.length - 1 ? 'CRITICAL' : 'NORMAL',
        text: `Question ${String(i)}`,
        linkedItems: [{ kind: 'requirement', id: m.id }],
      }),
    );
    const plan = planQuestions(generated, many, modules, new Set());
    expect(plan.questions).toHaveLength(MAX_QUESTIONS_PER_RUN);
    expect(plan.dropped.overLimit).toBe(5);
    expect(plan.questions[0]?.priority).toBe('CRITICAL');
  });
});
