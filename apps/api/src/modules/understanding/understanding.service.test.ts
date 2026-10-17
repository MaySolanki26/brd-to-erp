import { describe, expect, it, vi } from 'vitest';
import type { ApplyAnswerLlmOutput, QuestionsLlmOutput, SummaryLlmOutput } from '@brd/shared';
import { createFakeRepository } from './fake-repository.js';
import { createUnderstandingService } from './understanding.service.js';
import { item, uuid } from './test-items.js';
import type { AnswerContext, PromptItem } from './understanding.types.js';

const ORG = uuid();
const PROJECT = uuid();

function promptItem(...args: Parameters<typeof item>): PromptItem {
  return { ...item(...args), excerpt: 'Source text of the item.' };
}

interface Scripted {
  summary?: SummaryLlmOutput | (() => SummaryLlmOutput);
  questions?: QuestionsLlmOutput;
  apply?: ApplyAnswerLlmOutput;
  fail?: Error;
}

function setup(seed: { items?: PromptItem[]; answers?: AnswerContext[] }, scripted: Scripted = {}) {
  const fake = createFakeRepository({ projectId: PROJECT, organizationId: ORG, ...seed });
  const run = vi.fn(
    async (options: { promptName: string; schema: { parse: (v: unknown) => unknown } }) => {
      if (scripted.fail) throw scripted.fail;
      const scriptedOutput =
        options.promptName === 'summary'
          ? typeof scripted.summary === 'function'
            ? scripted.summary()
            : scripted.summary
          : options.promptName === 'questions'
            ? scripted.questions
            : scripted.apply;
      // Validate like the real service does, so a bad script fails the test loudly.
      return {
        output: options.schema.parse(scriptedOutput),
        usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
      };
    },
  );
  const audit = vi.fn(async () => undefined);
  const service = createUnderstandingService({
    repo: fake.repo,
    llm: { run } as never,
    transaction: async (fn) => fn({} as never),
    audit,
  });
  return { ...fake, run, audit, service };
}

const payload = { organizationId: ORG, projectId: PROJECT };
const emptySummary: SummaryLlmOutput = {
  overview: 'A billing system.',
  modules: [],
  keyRequirements: [],
  keyRules: [],
  assumptions: [],
  staleItems: [],
};

describe('refreshSummary', () => {
  it('skips a project outside the organization and an empty project, without calling the model', async () => {
    const { service, run } = setup({ items: [promptItem('requirement')] });
    expect(await service.refreshSummary({ organizationId: uuid(), projectId: PROJECT })).toBe(
      'skipped',
    );
    const empty = setup({});
    expect(await empty.service.refreshSummary(payload)).toBe('empty');
    expect(run).not.toHaveBeenCalled();
    expect(empty.run).not.toHaveBeenCalled();
  });

  it('stores version 1 with ids cleaned against the real items, and audits it', async () => {
    const real = promptItem('requirement', 'CONFIRMED');
    const { service, state, audit, run } = setup(
      { items: [real] },
      {
        summary: {
          ...emptySummary,
          keyRequirements: [
            { requirementId: real.id, why: 'Core.' },
            { requirementId: uuid(), why: 'Invented.' },
          ],
        },
      },
    );
    expect(await service.refreshSummary(payload)).toBe('created');
    expect(state.summaries).toHaveLength(1);
    expect(state.summaries[0]?.version).toBe(1);
    expect(state.summaries[0]?.content.keyRequirements).toEqual([
      { requirementId: real.id, why: 'Core.' },
    ]);
    expect(state.summaries[0]?.basedOn).toMatchObject({ requirements: 1, rules: 0, modules: 0 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'ProjectSummary' }),
      expect.anything(),
    );
  });

  it('does nothing and does not call the model again when the inputs have not changed (job retry)', async () => {
    const { service, state, run } = setup(
      { items: [promptItem('requirement')] },
      { summary: emptySummary },
    );
    await service.refreshSummary(payload);
    expect(await service.refreshSummary(payload)).toBe('unchanged');
    expect(state.summaries).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('increments the version only when the items change', async () => {
    const { service, state, run } = setup(
      { items: [promptItem('requirement')] },
      { summary: emptySummary },
    );
    await service.refreshSummary(payload);
    state.items.push(promptItem('rule', 'OPEN'));
    expect(await service.refreshSummary(payload)).toBe('created');
    expect(state.summaries.map((s) => s.version)).toEqual([1, 2]);

    state.items[0] = { ...state.items[0]!, status: 'CONFIRMED' } as PromptItem;
    await service.refreshSummary(payload);
    expect(state.summaries.map((s) => s.version)).toEqual([1, 2, 3]);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('keeps one summary when another worker stored the same inputs meanwhile', async () => {
    const { service, state } = setup(
      { items: [promptItem('requirement')] },
      { summary: emptySummary },
    );
    // The other worker finishes between our model call and our write.
    state.beforeSummaryWrite = () => {
      state.beforeSummaryWrite = undefined;
      void service.refreshSummary(payload);
    };
    await service.refreshSummary(payload);
    expect(state.summaries).toHaveLength(1);
  });

  it('stores nothing when the model call fails', async () => {
    const { service, state } = setup(
      { items: [promptItem('requirement')] },
      { fail: new Error('boom') },
    );
    await expect(service.refreshSummary(payload)).rejects.toThrow('boom');
    expect(state.summaries).toEqual([]);
  });
});

describe('generateQuestions', () => {
  const requirement = promptItem('requirement', 'OPEN', { title: 'Refunds' });
  const gap = (over: Partial<QuestionsLlmOutput['questions'][number]> = {}) => ({
    reason: 'GAP' as const,
    priority: 'HIGH' as const,
    text: 'How long do refunds take?',
    moduleId: null,
    linkedItems: [{ kind: 'requirement' as const, id: requirement.id }],
    ...over,
  });

  it('creates questions linked to real items and gives the model the project summary as cached context', async () => {
    const { service, state, run } = setup(
      { items: [requirement] },
      { summary: emptySummary, questions: { questions: [gap()] } },
    );
    await service.refreshSummary(payload);
    expect(await service.generateQuestions(payload)).toEqual({ status: 'generated', created: 1 });

    expect(state.questions).toHaveLength(1);
    expect(state.questions[0]).toMatchObject({
      reason: 'GAP',
      priority: 'HIGH',
      parentQuestionId: null,
      status: 'OPEN',
      linkedItems: [{ kind: 'requirement', id: requirement.id }],
    });
    const call = run.mock.calls.find(([o]) => o.promptName === 'questions');
    expect((call?.[0] as { cachedContext?: string }).cachedContext).toContain('A billing system.');
  });

  it('sends no cached context while there is no summary yet', async () => {
    const { service, run } = setup({ items: [requirement] }, { questions: { questions: [] } });
    await service.generateQuestions(payload);
    expect((run.mock.calls[0]?.[0] as { cachedContext?: string }).cachedContext).toBeUndefined();
  });

  it('never asks the same gap twice, however many times the job runs', async () => {
    const { service, state } = setup(
      { items: [requirement] },
      { questions: { questions: [gap()] } },
    );
    await service.generateQuestions(payload);
    const second = await service.generateQuestions(payload);
    const reworded = setup(
      { items: [requirement] },
      { questions: { questions: [gap(), gap({ text: 'Refund time?' })] } },
    );
    await reworded.service.generateQuestions(payload);

    expect(second).toEqual({ status: 'generated', created: 0 });
    expect(state.questions).toHaveLength(1);
    expect(reworded.state.questions).toHaveLength(1);
  });

  it('does not bring back a dismissed question', async () => {
    const { service, state } = setup(
      { items: [requirement] },
      { questions: { questions: [gap()] } },
    );
    await service.generateQuestions(payload);
    state.questions[0]!.status = 'DISMISSED';
    await service.generateQuestions(payload);
    expect(state.questions).toHaveLength(1);
  });

  it('ignores items it was not shown and does nothing without usable items', async () => {
    const rejected = promptItem('requirement', 'REJECTED');
    const none = setup({ items: [rejected] }, {});
    expect(await none.service.generateQuestions(payload)).toEqual({ status: 'empty' });
    expect(none.run).not.toHaveBeenCalled();

    const { service, state } = setup(
      { items: [requirement] },
      { questions: { questions: [gap({ linkedItems: [{ kind: 'requirement', id: uuid() }] })] } },
    );
    expect(await service.generateQuestions(payload)).toEqual({ status: 'generated', created: 0 });
    expect(state.questions).toEqual([]);
  });

  it('skips a project outside the organization', async () => {
    const { service, run } = setup({ items: [requirement] }, {});
    expect(await service.generateQuestions({ organizationId: uuid(), projectId: PROJECT })).toEqual(
      {
        status: 'skipped',
      },
    );
    expect(run).not.toHaveBeenCalled();
  });
});

describe('applyAnswer', () => {
  const open = promptItem('requirement', 'OPEN', { title: 'Refund timing', description: 'TBD' });
  const confirmed = promptItem('requirement', 'CONFIRMED', { title: 'Invoice monthly' });
  const answerId = uuid();
  const questionId = uuid();

  function answer(linked = [open, confirmed], over: Partial<AnswerContext> = {}): AnswerContext {
    return {
      answerId,
      text: 'Refunds take 5 working days.',
      answeredById: uuid(),
      appliedAt: null,
      question: {
        id: questionId,
        text: 'How long do refunds take?',
        reason: 'GAP',
        priority: 'HIGH',
        moduleId: null,
        linked: linked.map(({ kind, id }) => ({ kind, id })),
      },
      ...over,
    };
  }

  const apply = (over: Partial<ApplyAnswerLlmOutput> = {}): ApplyAnswerLlmOutput => ({
    changes: [],
    conflicts: [],
    followUpQuestions: [],
    decisionSummary: 'Refunds take 5 working days.',
    ...over,
  });
  const change = (target: PromptItem, over: object = {}) => ({
    kind: target.kind,
    id: target.id,
    newStatus: null,
    newTitle: null,
    newDescription: null,
    reason: 'Per the answer.',
    ...over,
  });

  it('updates the item, marks the answer applied and records the decision with before and after', async () => {
    const { service, state, audit } = setup(
      { items: [open, confirmed], answers: [answer()] },
      {
        apply: apply({
          changes: [change(open, { newStatus: 'CONFIRMED', newDescription: '5 working days.' })],
        }),
      },
    );
    const result = await service.applyAnswer({ ...payload, answerId });

    expect(result).toEqual({ status: 'applied', changed: 1, conflicts: 0, followUps: 0 });
    expect(state.items[0]).toMatchObject({ status: 'CONFIRMED', description: '5 working days.' });
    expect(state.answers.get(answerId)?.appliedAt).toBeInstanceOf(Date);
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]?.changes[0]).toMatchObject({
      id: open.id,
      before: { status: 'OPEN', description: 'TBD' },
      after: { status: 'CONFIRMED', description: '5 working days.' },
    });
    expect(state.decisions[0]?.summary).toBe('Refunds take 5 working days.');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Decision',
        metadata: expect.objectContaining({ changed: 1 }),
      }),
      expect.anything(),
    );
  });

  it('conflict path: a CONFIRMED item is left alone, recorded as a conflict, and a critical question is raised', async () => {
    const { service, state } = setup(
      { items: [open, confirmed], answers: [answer()] },
      {
        apply: apply({
          changes: [change(confirmed, { newStatus: 'REJECTED', reason: 'Answer says quarterly.' })],
        }),
      },
    );
    const result = await service.applyAnswer({ ...payload, answerId });

    expect(result).toMatchObject({ status: 'applied', changed: 0, conflicts: 1, followUps: 1 });
    expect(state.items.find((i) => i.id === confirmed.id)).toMatchObject({
      status: 'CONFIRMED',
      title: 'Invoice monthly',
    });
    expect(state.decisions[0]?.changes).toEqual([]);
    expect(state.decisions[0]?.conflicts).toEqual([
      expect.objectContaining({ id: confirmed.id, explanation: 'Answer says quarterly.' }),
    ]);
    expect(state.questions).toHaveLength(1);
    expect(state.questions[0]).toMatchObject({
      reason: 'CONFLICT',
      priority: 'CRITICAL',
      parentQuestionId: questionId,
      linkedItems: [{ kind: 'requirement', id: confirmed.id }],
    });
  });

  it('turns a change into a conflict when the item was confirmed while the answer was applied', async () => {
    const { service, state } = setup(
      { items: [open], answers: [answer([open])] },
      { apply: apply({ changes: [change(open, { newStatus: 'REJECTED' })] }) },
    );
    state.refuseUpdates.add(`requirement:${open.id}`);
    const result = await service.applyAnswer({ ...payload, answerId });

    expect(result).toMatchObject({ changed: 0, conflicts: 1, followUps: 1 });
    expect(state.decisions[0]?.changes).toEqual([]);
    expect(state.decisions[0]?.conflicts[0]?.explanation).toMatch(/confirmed while/);
    expect(state.questions[0]?.reason).toBe('CONFLICT');
  });

  it('creates follow-up questions linked to the answered one', async () => {
    const { service, state } = setup(
      { items: [open], answers: [answer([open])] },
      {
        apply: apply({
          followUpQuestions: [
            {
              reason: 'MISSING_RULE',
              priority: 'NORMAL',
              text: 'Who approves refunds above 500?',
              moduleId: null,
              linkedItems: [
                { kind: 'requirement', id: open.id },
                { kind: 'requirement', id: uuid() },
              ],
            },
          ],
        }),
      },
    );
    const result = await service.applyAnswer({ ...payload, answerId });

    expect(result).toMatchObject({ status: 'applied', followUps: 1 });
    expect(state.questions).toHaveLength(1);
    expect(state.questions[0]).toMatchObject({
      reason: 'MISSING_RULE',
      parentQuestionId: questionId,
      linkedItems: [{ kind: 'requirement', id: open.id }],
    });
  });

  it('is idempotent: a retry changes nothing and does not call the model again', async () => {
    const { service, state, run } = setup(
      { items: [open], answers: [answer([open])] },
      {
        apply: apply({
          changes: [change(open, { newStatus: 'CONFIRMED' })],
          followUpQuestions: [
            {
              reason: 'GAP',
              priority: 'NORMAL',
              text: 'Anything else?',
              moduleId: null,
              linkedItems: [{ kind: 'requirement', id: open.id }],
            },
          ],
        }),
      },
    );
    await service.applyAnswer({ ...payload, answerId });
    const again = await service.applyAnswer({ ...payload, answerId });

    expect(again).toEqual({ status: 'already-applied' });
    expect(state.decisions).toHaveLength(1);
    expect(state.questions).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stops without writing when another worker claimed the answer first', async () => {
    const { service, state } = setup(
      { items: [open], answers: [answer([open])] },
      { apply: apply({ changes: [change(open, { newStatus: 'CONFIRMED' })] }) },
    );
    state.claimsDenied = true;
    expect(await service.applyAnswer({ ...payload, answerId })).toEqual({
      status: 'already-applied',
    });
    expect(state.items[0]?.status).toBe('OPEN');
    expect(state.decisions).toEqual([]);
  });

  it('records the decision without calling the model when the question has no linked items', async () => {
    const { service, state, run } = setup({ items: [open], answers: [answer([])] }, {});
    const result = await service.applyAnswer({ ...payload, answerId });
    expect(result).toMatchObject({ status: 'applied', changed: 0 });
    expect(run).not.toHaveBeenCalled();
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]?.summary).toBe('The answer was recorded.');
  });

  it('leaves the answer unapplied when the model call fails, so the job can retry', async () => {
    const { service, state } = setup(
      { items: [open], answers: [answer([open])] },
      { fail: new Error('provider down') },
    );
    await expect(service.applyAnswer({ ...payload, answerId })).rejects.toThrow('provider down');
    expect(state.answers.get(answerId)?.appliedAt).toBeNull();
    expect(state.decisions).toEqual([]);
  });

  it('skips an unknown answer and one from another organization', async () => {
    const { service, run } = setup({ items: [open], answers: [answer([open])] }, {});
    expect(await service.applyAnswer({ ...payload, answerId: uuid() })).toEqual({
      status: 'skipped',
    });
    expect(
      await service.applyAnswer({ organizationId: uuid(), projectId: PROJECT, answerId }),
    ).toEqual({ status: 'skipped' });
    expect(run).not.toHaveBeenCalled();
  });

  it('sends the project summary as cached context when one exists', async () => {
    const { service, run } = setup(
      { items: [open], answers: [answer([open])] },
      { summary: emptySummary, apply: apply() },
    );
    await service.refreshSummary(payload);
    await service.applyAnswer({ ...payload, answerId });
    const call = run.mock.calls.find(([o]) => o.promptName === 'apply-answer');
    expect((call?.[0] as { cachedContext?: string }).cachedContext).toContain('A billing system.');
  });
});
