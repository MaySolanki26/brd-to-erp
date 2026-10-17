/**
 * Records model answers over the files in evals/samples, so tests can replay them without a network
 * or a key. Stage one reads every chunk with the extraction prompt; stage two writes the project
 * summary and asks the questions (one call per batch of items) over what stage one found.
 *
 *   pnpm --filter @brd/api fixtures:record                      both stages
 *   pnpm --filter @brd/api fixtures:record -- --extraction-only  stage one only
 *   pnpm --filter @brd/api fixtures:record -- --dry-run          only counts chunks (no key, no cost)
 *
 * The summary and question prompts take item ids as input and the recording uses stable ids made from
 * each item's kind and title, so these answers replay in tests but not against a real database: run
 * those jobs with the real model there.
 *
 * Needs LLM_DRIVER=real and ANTHROPIC_API_KEY. Only the model's answers and token counts are saved,
 * never the sample text; read the files before committing because an answer can quote the sample.
 */
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { extractSamples, loadSamples, runUnderstanding } from '../modules/extraction/sample-run.js';
import { AnthropicProvider } from '../services/llm/anthropic.provider.js';
import { RecordingProvider } from '../services/llm/fixture.provider.js';
import { createLlmService } from '../services/llm/llm.service.js';
import { createPromptLoader } from '../services/llm/prompt-loader.js';

const repoRoot = new URL('../../../../', import.meta.url);
const samplesDir = fileURLToPath(new URL('evals/samples/', repoRoot));
const fixturesDir = fileURLToPath(new URL('evals/fixtures/', repoRoot));
const promptsDir = fileURLToPath(new URL('prompts/', repoRoot));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const chunks = await loadSamples(samplesDir);
  if (chunks.length === 0) fail(`No supported sample files found in ${samplesDir}`);
  const files = new Set(chunks.map((chunk) => chunk.file));
  console.log(`${String(chunks.length)} chunks from ${String(files.size)} file(s) in evals/samples`);

  if (process.argv.includes('--dry-run')) {
    console.log('Dry run: nothing was sent to the model.');
    return;
  }
  if (env.LLM_DRIVER !== 'real') {
    fail('Set LLM_DRIVER=real: recording needs the real model. Use --dry-run to only count chunks.');
  }
  if (!env.ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY is not set.');

  const usage = { calls: 0, input: 0, output: 0, cached: 0 };
  const llm = createLlmService({
    provider: new RecordingProvider(
      new AnthropicProvider(
        new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 }),
        env.LLM_MODEL,
        env.LLM_EFFORT,
      ),
      fixturesDir,
    ),
    loadPrompt: createPromptLoader(promptsDir),
    usage: {
      record: async (row) => {
        usage.calls += 1;
        usage.input += row.promptTokens;
        usage.output += row.completionTokens;
        usage.cached += row.cachedTokens;
      },
      tokensUsedSince: async () => 0,
    },
    monthlyTokenBudget: Number.MAX_SAFE_INTEGER,
    maxOutputTokens: env.LLM_MAX_OUTPUT_TOKENS,
  });

  const extracted = await extractSamples(chunks, llm, (done, total) => {
    if (done % 10 === 0 || done === total) console.log(`  ${String(done)}/${String(total)} chunks`);
  });
  console.log('Extracted:', extracted.summary);
  if (!process.argv.includes('--extraction-only')) {
    console.log('Understanding:', await runUnderstanding(extracted, llm));
  }
  console.log(
    `Model calls: ${String(usage.calls)}; tokens in ${String(usage.input)} (cached ${String(usage.cached)}), out ${String(usage.output)}`,
  );
  console.log('Fixtures are in evals/fixtures/. Review them before you commit.');
}

main().catch((err: unknown) => {
  // The message is ours or the SDK mapper's; it never holds sample text.
  console.error(err instanceof Error ? err.message : 'Recording failed');
  process.exit(1);
});
