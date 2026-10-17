import { describe, expect, it } from 'vitest';
import type { ApplyAnswerLlmOutput } from '@brd/shared';
import { NO_SUMMARY, conflictQuestion, planAnswer } from './plan-answer.js';
import { item, uuid } from './test-items.js';

const open = item('requirement', 'OPEN', { title: 'Refund timing', description: 'TBD' });
const assumed = item('rule', 'ASSUMED', { title: 'VAT 20%' });
const confirmed = item('requirement', 'CONFIRMED', { title: 'Invoice monthly', moduleId: uuid() });
const linked = [open, assumed, confirmed];

function output(over: Partial<ApplyAnswerLlmOutput> = {}): ApplyAnswerLlmOutput {
  return {
    changes: [],
    conflicts: [],
    followUpQuestions: [],
    decisionSummary: 'Decided.',
    ...over,
  };
}

const change = (
  target: { kind: 'requirement' | 'rule' | 'module'; id: string },
  over: Partial<ApplyAnswerLlmOutput['changes'][number]> = {},
): ApplyAnswerLlmOutput['changes'][number] => ({
  ...target,
  newStatus: null,
  newTitle: null,
  newDescription: null,
  reason: 'Because the answer says so.',
  ...over,
});

describe('planAnswer', () => {
  it('records before and after for a real change', () => {
    const plan = planAnswer(
      output({
        changes: [
          change(open, { newStatus: 'CONFIRMED', newDescription: 'Within 5 working days.' }),
        ],
      }),
      linked,
    );
    expect(plan.changes).toEqual([
      {
        kind: 'requirement',
        id: open.id,
        before: { status: 'OPEN', title: 'Refund timing', description: 'TBD' },
        after: {
          status: 'CONFIRMED',
          title: 'Refund timing',
          description: 'Within 5 working days.',
        },
        reason: 'Because the answer says so.',
      },
    ]);
    expect(plan.summary).toBe('Decided.');
  });

  it('never changes a CONFIRMED item: the attempt becomes a conflict', () => {
    const plan = planAnswer(
      output({
        changes: [change(confirmed, { newStatus: 'REJECTED', reason: 'Answer says quarterly.' })],
      }),
      linked,
    );
    expect(plan.changes).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      kind: 'requirement',
      id: confirmed.id,
      title: 'Invoice monthly',
      explanation: 'Answer says quarterly.',
    });
  });

  it('keeps a conflict the model reported properly, once, and only for CONFIRMED items', () => {
    const plan = planAnswer(
      output({
        conflicts: [
          { kind: 'requirement', id: confirmed.id, explanation: 'Monthly vs quarterly.' },
          { kind: 'requirement', id: confirmed.id, explanation: 'Said again.' },
          { kind: 'rule', id: assumed.id, explanation: 'Not confirmed, so not a conflict.' },
        ],
      }),
      linked,
    );
    expect(plan.conflicts.map((c) => c.id)).toEqual([confirmed.id]);
    expect(plan.conflicts[0]?.explanation).toBe('Monthly vs quarterly.');
  });

  it('cannot touch an item outside the question, or one under the wrong kind', () => {
    const stranger = item('requirement');
    const plan = planAnswer(
      output({
        changes: [
          change(stranger, { newStatus: 'CONFIRMED' }),
          change({ kind: 'rule', id: open.id }, { newStatus: 'CONFIRMED' }),
        ],
      }),
      linked,
    );
    expect(plan.changes).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('skips changes that change nothing, and applies only the first change per item', () => {
    const plan = planAnswer(
      output({
        changes: [
          change(open, { newStatus: 'OPEN', newTitle: 'Refund timing' }),
          change(assumed, { newStatus: 'CONFIRMED' }),
          change(assumed, { newStatus: 'REJECTED' }),
        ],
      }),
      linked,
    );
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.after.status).toBe('CONFIRMED');
  });

  it('keeps the old title or description when the model sends an empty one', () => {
    const plan = planAnswer(
      output({
        changes: [change(open, { newStatus: 'ASSUMED', newTitle: '   ', newDescription: ' ' })],
      }),
      linked,
    );
    expect(plan.changes[0]?.after).toEqual({
      status: 'ASSUMED',
      title: 'Refund timing',
      description: 'TBD',
    });
  });

  it('falls back to a plain summary and passes follow-up questions through', () => {
    const followUp = {
      reason: 'GAP' as const,
      priority: 'NORMAL' as const,
      text: 'Who approves refunds?',
      moduleId: null,
      linkedItems: [{ kind: 'requirement' as const, id: open.id }],
    };
    const plan = planAnswer(
      output({ decisionSummary: '  ', followUpQuestions: [followUp] }),
      linked,
    );
    expect(plan.summary).toBe(NO_SUMMARY);
    expect(plan.followUps).toEqual([followUp]);
  });
});

describe('conflictQuestion', () => {
  it('raises a critical CONFLICT question about the confirmed item, worded by us', () => {
    const [conflict] = planAnswer(
      output({
        changes: [change(confirmed, { newStatus: 'REJECTED', reason: 'Quarterly instead.' })],
      }),
      linked,
    ).conflicts;
    if (!conflict) throw new Error('expected a conflict');
    const question = conflictQuestion(conflict);
    expect(question).toMatchObject({
      reason: 'CONFLICT',
      priority: 'CRITICAL',
      moduleId: confirmed.moduleId,
      linkedItems: [{ kind: 'requirement', id: confirmed.id }],
    });
    expect(question.text).toContain('Invoice monthly');
    expect(question.text).toContain('Quarterly instead.');
  });
});
