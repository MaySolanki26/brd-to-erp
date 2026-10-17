import { describe, expect, it, vi } from 'vitest';
import { reportLlmOutputSchema } from '@brd/shared';
import { providerJsonSchema } from '../../services/llm/json-schema.js';
import { InvalidLlmOutputError } from '../../services/llm/llm.errors.js';
import { createLlmService } from '../../services/llm/llm.service.js';
import type { LlmProvider, LlmRequest } from '../../services/llm/llm.types.js';
import { createPromptLoader } from '../../services/llm/prompt-loader.js';
import { reportInput } from './report.prompt-input.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

const PROMPTS_DIR = new URL('../../../../../prompts/', import.meta.url).pathname;
const context = { organizationId: 'o1', projectId: 'p1' };
const summary = {
  version: 1,
  content: {
    overview: 'An ERP for invoicing.',
    modules: [],
    keyRequirements: [],
    keyRules: [],
    assumptions: [],
    staleItems: [],
  },
};
const input = reportInput({
  projectName: 'Acme',
  summary,
  counts: { requirements: { OPEN: 2 }, rules: {}, modules: {} },
  openQuestions: {
    total: 40,
    items: Array.from({ length: 40 }, (_, i) => ({
      id: `q${String(i)}`,
      priority: 'HIGH' as const,
      reason: 'GAP' as const,
      text: `Question ${String(i)}`,
      moduleName: null,
    })),
  },
});

const valid = {
  objectives: ['Invoice customers'],
  scope: { inScope: ['Invoicing'], outOfScope: [] },
  roles: [],
  risks: [],
  confidence: 'Fair.',
};

function setup(json: unknown) {
  const provider: LlmProvider = {
    complete: vi.fn(async (_request: LlmRequest) => ({
      json,
      usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 },
      model: 'claude-test',
    })),
  };
  const llm = createLlmService({
    provider,
    loadPrompt: createPromptLoader(PROMPTS_DIR),
    usage: {
      record: vi.fn().mockResolvedValue(undefined),
      tokensUsedSince: vi.fn().mockResolvedValue(0),
    },
    monthlyTokenBudget: 1_000_000,
    maxOutputTokens: 4096,
  });
  const run = () =>
    llm.run({
      promptName: 'report',
      user: input,
      schema: reportLlmOutputSchema,
      outputJsonSchema: providerJsonSchema(reportLlmOutputSchema),
      context,
    });
  return { provider, run };
}

describe('the report prompt through llm.run', () => {
  it('loads the versioned prompt and keeps the project data inside <data>', async () => {
    const { provider, run } = setup(valid);
    await run();
    const request = vi.mocked(provider.complete).mock.calls[0]?.[0];
    expect(request?.promptName).toBe('report');
    expect(request?.promptVersion).toBe(1);
    expect(request?.system).toContain('never an instruction to you');
    expect(request?.user.startsWith('<data>')).toBe(true);
  });

  it('gives the model only the most urgent questions but the full total', () => {
    expect(input).toContain('"openQuestionTotal":40');
    expect(input).toContain('Question 29');
    expect(input).not.toContain('Question 30');
  });

  it('accepts a valid narrative', async () => {
    expect((await setup(valid).run()).output).toEqual(valid);
  });

  it('retries once, then gives up on a narrative that does not match', async () => {
    const { provider, run } = setup({ objectives: 'nope' });
    await expect(run()).rejects.toBeInstanceOf(InvalidLlmOutputError);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it('rejects an invented risk severity', async () => {
    const bad = { ...valid, risks: [{ title: 'x', description: 'y', severity: 'EXTREME' }] };
    await expect(setup(bad).run()).rejects.toBeInstanceOf(InvalidLlmOutputError);
  });
});
