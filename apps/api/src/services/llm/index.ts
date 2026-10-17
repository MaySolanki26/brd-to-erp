import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { AnthropicProvider } from './anthropic.provider.js';
import { FixtureProvider, RecordingProvider } from './fixture.provider.js';
import { LlmConfigError } from './llm.errors.js';
import { createLlmService } from './llm.service.js';
import type { LlmProvider } from './llm.types.js';
import * as usage from './llm-usage.repository.js';
import { createPromptLoader } from './prompt-loader.js';

export * from './llm.errors.js';
export type { LlmRunOptions, LlmRunResult, LlmService } from './llm.service.js';

// Resolved from the repository root so the same paths work from src/ and dist/.
const repoRoot = new URL('../../../../../', import.meta.url);
const promptsDir = fileURLToPath(new URL('prompts/', repoRoot));
const fixturesDir = fileURLToPath(new URL('evals/fixtures/', repoRoot));

function createProvider(): LlmProvider {
  if (env.LLM_DRIVER === 'fixture') {
    return new FixtureProvider(fixturesDir);
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new LlmConfigError('ANTHROPIC_API_KEY is required when LLM_DRIVER is "real"');
  }
  const real = new AnthropicProvider(
    new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 }),
    env.LLM_MODEL,
    env.LLM_EFFORT,
  );
  return env.LLM_RECORD_FIXTURES ? new RecordingProvider(real, fixturesDir) : real;
}

export const llmService = createLlmService({
  provider: createProvider(),
  loadPrompt: createPromptLoader(promptsDir),
  usage: { record: usage.recordUsage, tokensUsedSince: usage.tokensUsedSince },
  monthlyTokenBudget: env.LLM_PROJECT_MONTHLY_TOKEN_BUDGET,
  maxOutputTokens: env.LLM_MAX_OUTPUT_TOKENS,
});
