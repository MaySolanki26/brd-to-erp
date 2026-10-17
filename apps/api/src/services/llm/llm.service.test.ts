import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

import {
  InvalidLlmOutputError,
  LlmBudgetExceededError,
  LlmRefusalError,
  LlmTransientError,
} from './llm.errors.js';
import { createLlmService } from './llm.service.js';
import type { LlmProvider, LlmResponse } from './llm.types.js';

const schema = z.object({ items: z.array(z.string()) });
const context = { organizationId: 'o1', projectId: 'p1', userId: 'u1' };
const SECRET = 'Highly confidential chunk text';

const good: LlmResponse = {
  json: { items: ['a'] },
  usage: { inputTokens: 100, outputTokens: 20, cachedTokens: 40 },
  model: 'claude-test',
};
const bad: LlmResponse = { ...good, json: { items: 'nope' } };

function setup(overrides: { used?: number; budget?: number; now?: Date } = {}) {
  const provider = { complete: vi.fn<LlmProvider['complete']>() };
  const usage = {
    record: vi.fn().mockResolvedValue(undefined),
    tokensUsedSince: vi.fn().mockResolvedValue(overrides.used ?? 0),
  };
  const service = createLlmService({
    provider,
    loadPrompt: (name) => ({ name, version: 2, system: 'Static instructions' }),
    usage,
    monthlyTokenBudget: overrides.budget ?? 1000,
    maxOutputTokens: 4096,
    now: () => overrides.now ?? new Date('2026-10-16T12:00:00Z'),
  });
  const run = (extra: { cachedContext?: string } = {}) =>
    service.run({
      promptName: 'extraction',
      user: SECRET,
      schema,
      outputJsonSchema: { type: 'object' },
      context,
      ...extra,
    });
  return { provider, usage, run };
}

describe('llmService.run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the prompt, validates the answer and records the usage', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockResolvedValue(good);

    const result = await run();

    expect(result.output).toEqual({ items: ['a'] });
    expect(provider.complete).toHaveBeenCalledWith({
      promptName: 'extraction',
      promptVersion: 2,
      system: 'Static instructions',
      user: SECRET,
      outputSchema: { type: 'object' },
      maxOutputTokens: 4096,
    });
    expect(usage.record).toHaveBeenCalledTimes(1);
    expect(usage.record.mock.calls[0]?.[0]).toMatchObject({
      organizationId: 'o1',
      projectId: 'p1',
      userId: 'u1',
      model: 'claude-test',
      promptName: 'extraction',
      promptTokens: 100,
      completionTokens: 20,
      cachedTokens: 40,
      status: 'OK',
    });
  });

  it('passes the project summary to the provider as cached context and never records it', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockResolvedValue(good);
    await run({ cachedContext: 'PROJECT-SUMMARY-TEXT' });
    expect(provider.complete.mock.calls[0]?.[0]).toMatchObject({
      cachedContext: 'PROJECT-SUMMARY-TEXT',
    });
    expect(JSON.stringify(usage.record.mock.calls)).not.toContain('PROJECT-SUMMARY-TEXT');
  });

  it('never stores prompt or document text in the usage record', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockResolvedValue(good);
    await run();
    expect(JSON.stringify(usage.record.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(usage.record.mock.calls)).not.toContain('Static instructions');
  });

  it('retries once when the first answer is invalid, recording both calls', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockResolvedValueOnce(bad).mockResolvedValueOnce(good);

    expect((await run()).output).toEqual({ items: ['a'] });
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(usage.record.mock.calls.map((c) => c[0].status)).toEqual(['INVALID_OUTPUT', 'OK']);
  });

  it('treats missing JSON like an invalid answer', async () => {
    const { provider, run } = setup();
    provider.complete
      .mockResolvedValueOnce({ ...good, json: undefined })
      .mockResolvedValueOnce(good);
    await expect(run()).resolves.toBeDefined();
  });

  it('gives up after one retry with InvalidLlmOutputError', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockResolvedValue(bad);

    await expect(run()).rejects.toBeInstanceOf(InvalidLlmOutputError);
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(usage.record.mock.calls.map((c) => c[0].status)).toEqual([
      'INVALID_OUTPUT',
      'INVALID_OUTPUT',
    ]);
  });

  it('does not retry provider errors and records them', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockRejectedValue(new LlmTransientError());

    await expect(run()).rejects.toBeInstanceOf(LlmTransientError);
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(usage.record.mock.calls[0]?.[0]).toMatchObject({ status: 'ERROR', promptTokens: 0 });
  });

  it('records refusals with their own status', async () => {
    const { provider, usage, run } = setup();
    provider.complete.mockRejectedValue(new LlmRefusalError());
    await expect(run()).rejects.toBeInstanceOf(LlmRefusalError);
    expect(usage.record.mock.calls[0]?.[0].status).toBe('REFUSED');
  });

  describe('monthly budget', () => {
    it('blocks the call before contacting the provider once the budget is used up', async () => {
      const { provider, usage, run } = setup({ used: 1000, budget: 1000 });
      const error = await run().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LlmBudgetExceededError);
      expect(error).toMatchObject({ used: 1000, budget: 1000 });
      expect(provider.complete).not.toHaveBeenCalled();
      expect(usage.record).not.toHaveBeenCalled();
    });

    it('allows a call while under the budget', async () => {
      const { provider, run } = setup({ used: 999, budget: 1000 });
      provider.complete.mockResolvedValue(good);
      await expect(run()).resolves.toBeDefined();
    });

    it('measures usage from the start of the current UTC month for this project', async () => {
      const { provider, usage, run } = setup({ now: new Date('2026-10-31T23:59:59Z') });
      provider.complete.mockResolvedValue(good);
      await run();
      expect(usage.tokensUsedSince).toHaveBeenCalledWith(
        'o1',
        'p1',
        new Date('2026-10-01T00:00:00Z'),
      );
    });
  });
});
