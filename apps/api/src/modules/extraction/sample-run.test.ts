import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractionLlmOutput } from '@brd/shared';
import { MAX_CHUNK_CHARS } from '../../jobs/chunker.js';
import { InvalidLlmOutputError } from '../../services/llm/llm.errors.js';
import { loadSamples, runSamples } from './sample-run.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

function folder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'samples-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const BRD = '# Billing\n\n## Invoices\nInvoices must be sent within 3 days.\n\n## Tax\nVAT is 20%.\n';

describe('loadSamples', () => {
  it('cuts markdown and text files into chunks with their heading paths', async () => {
    const chunks = await loadSamples(folder({ 'brd.md': BRD, 'notes.txt': 'Plain notes.' }));
    expect(chunks.map((c) => [c.file, c.headingPath.join(' > ')])).toEqual([
      ['brd.md', 'brd > Billing > Invoices'],
      ['brd.md', 'brd > Billing > Tax'],
      ['notes.txt', 'notes'],
    ]);
  });

  it('ignores hidden and unsupported files', async () => {
    const chunks = await loadSamples(folder({ '.gitkeep': '', 'image.png': 'x', 'brd.md': BRD }));
    expect(new Set(chunks.map((c) => c.file))).toEqual(new Set(['brd.md']));
  });

  it('gives the same chunk ids every time, so recorded fixtures keep matching', async () => {
    const dir = folder({ 'brd.md': BRD });
    const first = await loadSamples(dir);
    const second = await loadSamples(dir);
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
    expect(new Set(first.map((c) => c.id)).size).toBe(first.length);
  });

  it('reads the BRD in evals/samples without making an oversized chunk', async () => {
    const dir = new URL('../../../../../evals/samples/', import.meta.url).pathname;
    const chunks = await loadSamples(dir);
    expect(chunks.length).toBeGreaterThan(10);
    expect(Math.max(...chunks.map((c) => c.content.length))).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });
});

describe('runSamples', () => {
  const output = (title: string): ExtractionLlmOutput => ({
    modules: [{ name: 'Billing', description: '' }],
    requirements: [{ title, description: 'x', moduleName: 'Billing' }],
    rules: [],
  });

  it('merges what the chunks state and reports the totals, without printing any text', async () => {
    const chunks = await loadSamples(folder({ 'brd.md': BRD }));
    let call = 0;
    const llm = {
      run: vi.fn(async (o: { schema: { parse: (v: unknown) => unknown } }) => {
        call += 1;
        return {
          // The second chunk repeats the first one's requirement: it is merged, not duplicated.
          output: o.schema.parse(output(call === 1 ? 'Send invoices' : 'send invoices')),
          usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
        };
      }),
    };
    const progress = vi.fn();
    const summary = await runSamples(chunks, llm as never, progress);

    expect(summary).toEqual({
      chunks: 2,
      flaggedForReview: 0,
      modules: 1,
      requirements: 1,
      rules: 0,
    });
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it('counts chunks the model could not answer twice as flagged for review', async () => {
    const chunks = await loadSamples(folder({ 'brd.md': BRD }));
    const llm = { run: vi.fn().mockRejectedValue(new InvalidLlmOutputError()) };
    expect(await runSamples(chunks, llm)).toMatchObject({
      chunks: 2,
      flaggedForReview: 2,
      requirements: 0,
    });
  });
});
