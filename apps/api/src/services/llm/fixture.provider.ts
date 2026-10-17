import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { FixtureMissingError, LlmConfigError } from './llm.errors.js';
import { fixtureHash } from './fixture-hash.js';
import type { LlmProvider, LlmRequest, LlmResponse, LlmTokenUsage } from './llm.types.js';

const fixtureFileSchema = z.object({
  output: z.unknown(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      cachedTokens: z.number().int().nonnegative().default(0),
    })
    .optional(),
});

const NO_USAGE: LlmTokenUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
const PROMPT_NAME = /^[a-z][a-z0-9-]*$/;

function fixturePath(dir: string, request: LlmRequest): string {
  if (!PROMPT_NAME.test(request.promptName)) {
    throw new LlmConfigError('Invalid prompt name');
  }
  return join(dir, request.promptName, `${fixtureHash(request)}.json`);
}

/** Answers from recorded files keyed by prompt name and input hash. Never calls a network. */
export class FixtureProvider implements LlmProvider {
  constructor(
    private readonly dir: string,
    private readonly model = 'fixture',
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let raw: string;
    try {
      raw = await readFile(fixturePath(this.dir, request), 'utf8');
    } catch (err) {
      if (err instanceof LlmConfigError) throw err;
      throw new FixtureMissingError(request.promptName, fixtureHash(request));
    }

    let file: z.infer<typeof fixtureFileSchema>;
    try {
      file = fixtureFileSchema.parse(JSON.parse(raw));
    } catch {
      throw new LlmConfigError(`Fixture for "${request.promptName}" is not valid`);
    }
    return { json: file.output, usage: file.usage ?? NO_USAGE, model: this.model };
  }
}

/**
 * Wraps a real provider and saves each answer as a fixture. Only the model's output and token
 * counts are written, never the input text, so recordings are safe to commit.
 */
export class RecordingProvider implements LlmProvider {
  constructor(
    private readonly inner: LlmProvider,
    private readonly dir: string,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await this.inner.complete(request);
    if (response.json !== undefined) {
      const path = fixturePath(this.dir, request);
      await mkdir(join(this.dir, request.promptName), { recursive: true });
      await writeFile(
        path,
        `${JSON.stringify({ output: response.json, usage: response.usage }, null, 2)}\n`,
        'utf8',
      );
    }
    return response;
  }
}
