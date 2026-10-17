import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { fixtureHash } from './fixture-hash.js';
import { FixtureProvider, RecordingProvider } from './fixture.provider.js';
import { FixtureMissingError, LlmConfigError } from './llm.errors.js';
import type { LlmProvider, LlmRequest } from './llm.types.js';

const request: LlmRequest = {
  promptName: 'extraction',
  promptVersion: 1,
  system: 'System instructions',
  user: 'Confidential chunk text about invoices',
  outputSchema: { type: 'object' },
  maxOutputTokens: 1000,
};

describe('fixtureHash', () => {
  it('is stable for the same input and ignores unrelated request fields', () => {
    const smaller: LlmRequest = { ...request, maxOutputTokens: 5 };
    expect(fixtureHash(request)).toBe(fixtureHash(smaller));
    expect(fixtureHash(request)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the prompt name, version, system or user text changes', () => {
    const base = fixtureHash(request);
    expect(fixtureHash({ ...request, promptName: 'other' })).not.toBe(base);
    expect(fixtureHash({ ...request, promptVersion: 2 })).not.toBe(base);
    expect(fixtureHash({ ...request, system: 'x' })).not.toBe(base);
    expect(fixtureHash({ ...request, user: 'x' })).not.toBe(base);
  });
});

describe('fixtureHash with a cached context', () => {
  it('changes when the context changes, and ignores an empty one', () => {
    const base = fixtureHash(request);
    expect(fixtureHash({ ...request, cachedContext: 'summary v1' })).not.toBe(base);
    expect(fixtureHash({ ...request, cachedContext: 'summary v1' })).not.toBe(
      fixtureHash({ ...request, cachedContext: 'summary v2' }),
    );
    expect(fixtureHash({ ...request, cachedContext: undefined })).toBe(base);
    expect(fixtureHash({ ...request, cachedContext: '' })).toBe(base);
  });
});

describe('FixtureProvider', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'brd-fixtures-'));
  });

  function place(contents: string, req: LlmRequest = request): void {
    mkdirSync(join(dir, req.promptName), { recursive: true });
    writeFileSync(join(dir, req.promptName, `${fixtureHash(req)}.json`), contents);
  }

  it('returns the recorded output and usage', async () => {
    place(JSON.stringify({ output: { items: [1] }, usage: { inputTokens: 10, outputTokens: 4 } }));
    expect(await new FixtureProvider(dir).complete(request)).toEqual({
      json: { items: [1] },
      usage: { inputTokens: 10, outputTokens: 4, cachedTokens: 0 },
      model: 'fixture',
    });
  });

  it('defaults to zero usage when none was recorded', async () => {
    place(JSON.stringify({ output: {} }));
    const response = await new FixtureProvider(dir).complete(request);
    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
  });

  it('fails with a clear, actionable error when nothing was recorded for the input', async () => {
    const error = await new FixtureProvider(dir).complete(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FixtureMissingError);
    expect((error as Error).message).toContain(fixtureHash(request).slice(0, 12));
    expect((error as Error).message).toMatch(/LLM_RECORD_FIXTURES/);
    expect((error as Error).message).not.toContain('Confidential');
  });

  it('rejects a corrupt fixture file and unsafe prompt names', async () => {
    place('{ not json');
    await expect(new FixtureProvider(dir).complete(request)).rejects.toBeInstanceOf(LlmConfigError);
    await expect(
      new FixtureProvider(dir).complete({ ...request, promptName: '../etc' }),
    ).rejects.toThrow(/Invalid prompt name/);
  });
});

describe('RecordingProvider', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'brd-record-'));
  });

  const inner = (json: unknown): LlmProvider => ({
    complete: async () => ({
      json,
      usage: { inputTokens: 7, outputTokens: 3, cachedTokens: 2 },
      model: 'claude-test',
    }),
  });

  it('saves only the output and usage, never the input text, and replays it', async () => {
    const recording = new RecordingProvider(inner({ answer: 42 }), dir);
    await recording.complete(request);

    const files = readdirSync(join(dir, 'extraction'));
    expect(files).toEqual([`${fixtureHash(request)}.json`]);
    const saved = readFileSync(join(dir, 'extraction', files[0] ?? ''), 'utf8');
    expect(saved).not.toContain('Confidential');
    expect(saved).not.toContain('System instructions');
    expect(JSON.parse(saved)).toEqual({
      output: { answer: 42 },
      usage: { inputTokens: 7, outputTokens: 3, cachedTokens: 2 },
    });

    const replay = await new FixtureProvider(dir).complete(request);
    expect(replay.json).toEqual({ answer: 42 });
  });

  it('does not save an answer that was not valid JSON', async () => {
    await new RecordingProvider(inner(undefined), dir).complete(request);
    expect(readdirSync(dir)).toEqual([]);
  });
});
