import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { LlmConfigError } from './llm.errors.js';
import { createPromptLoader } from './prompt-loader.js';

describe('createPromptLoader', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'brd-prompts-'));
  });

  it('reads the version and the system prompt body', () => {
    writeFileSync(
      join(dir, 'extraction.md'),
      '---\nversion: 3\n---\nYou extract things.\n\nBe precise.\n',
    );
    expect(createPromptLoader(dir)('extraction')).toEqual({
      name: 'extraction',
      version: 3,
      system: 'You extract things.\n\nBe precise.',
    });
  });

  it('handles Windows line endings', () => {
    writeFileSync(join(dir, 'a.md'), '---\r\nversion: 1\r\n---\r\nBody');
    expect(createPromptLoader(dir)('a').version).toBe(1);
  });

  it('caches a loaded prompt', () => {
    writeFileSync(join(dir, 'a.md'), '---\nversion: 1\n---\nOne');
    const load = createPromptLoader(dir);
    const first = load('a');
    writeFileSync(join(dir, 'a.md'), '---\nversion: 2\n---\nTwo');
    expect(load('a')).toBe(first);
  });

  it('rejects a missing prompt, missing front-matter and unsafe names', () => {
    writeFileSync(join(dir, 'plain.md'), 'No front matter');
    const load = createPromptLoader(dir);
    expect(() => load('absent')).toThrow(LlmConfigError);
    expect(() => load('plain')).toThrow(/version/);
    for (const bad of ['../secret', 'a/b', '', 'Upper', '.hidden']) {
      expect(() => load(bad)).toThrow(/Invalid prompt name/);
    }
  });
});
