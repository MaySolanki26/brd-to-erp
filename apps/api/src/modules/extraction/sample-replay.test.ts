import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { FixtureProvider } from '../../services/llm/fixture.provider.js';
import { createLlmService } from '../../services/llm/llm.service.js';
import { createPromptLoader } from '../../services/llm/prompt-loader.js';
import { extractSamples, loadSamples, runUnderstanding } from './sample-run.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

const root = new URL('../../../../../', import.meta.url);
const samplesDir = new URL('evals/samples/', root).pathname;
const fixturesDir = new URL('evals/fixtures/', root).pathname;
const recorded = existsSync(`${fixturesDir}extraction`);
const understandingRecorded = existsSync(`${fixturesDir}summary`) && existsSync(`${fixturesDir}questions`);

function replayer() {
  return createLlmService({
    provider: new FixtureProvider(fixturesDir),
    loadPrompt: createPromptLoader(`${root.pathname}prompts`),
    usage: { record: async () => undefined, tokensUsedSince: async () => 0 },
    monthlyTokenBudget: Number.MAX_SAFE_INTEGER,
    maxOutputTokens: 4096,
  });
}

// Replays the answers recorded by `pnpm --filter @brd/api fixtures:record`. It needs those files, so it
// is skipped on a checkout that does not have them; a changed prompt or chunker needs a re-record.
describe.skipIf(!recorded)('the sample BRD replayed from recorded answers', () => {
  it('finds modules, requirements and rules and flags no chunk for review', async () => {
    const chunks = await loadSamples(samplesDir);
    const { summary } = await extractSamples(chunks, replayer());

    expect(summary.chunks).toBe(chunks.length);
    expect(summary.flaggedForReview).toBe(0);
    expect(summary.modules).toBeGreaterThan(0);
    expect(summary.requirements).toBeGreaterThan(0);
    expect(summary.rules).toBeGreaterThan(0);
  });
});

// Needs the second stage of `fixtures:record`, which also records the summary and the questions.
describe.skipIf(!recorded || !understandingRecorded)('the sample BRD, summarised and questioned', () => {
  it('writes a summary and raises questions from what was extracted', async () => {
    const llm = replayer();
    const extracted = await extractSamples(await loadSamples(samplesDir), llm);
    const result = await runUnderstanding(extracted, llm);

    expect(result.summary).toBe('created');
    expect(result.batches).toBeGreaterThan(0);
    expect(result.questions).toBeGreaterThan(0);
  });
});
