import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LlmConfigError } from './llm.errors.js';

export interface PromptTemplate {
  name: string;
  version: number;
  system: string;
}

const PROMPT_NAME = /^[a-z][a-z0-9-]*$/;
const FRONT_MATTER = /^---\r?\nversion:\s*(\d+)\s*\r?\n---\r?\n/;

/** Loads `<dir>/<name>.md`: a `version` front-matter line, then the system prompt. */
export function createPromptLoader(dir: string): (name: string) => PromptTemplate {
  const cache = new Map<string, PromptTemplate>();

  return (name) => {
    const cached = cache.get(name);
    if (cached) return cached;
    if (!PROMPT_NAME.test(name)) {
      throw new LlmConfigError('Invalid prompt name');
    }

    let raw: string;
    try {
      raw = readFileSync(join(dir, `${name}.md`), 'utf8');
    } catch {
      throw new LlmConfigError(`Prompt "${name}" was not found`);
    }
    const match = FRONT_MATTER.exec(raw);
    if (!match?.[1]) {
      throw new LlmConfigError(`Prompt "${name}" has no version front-matter`);
    }

    const template: PromptTemplate = {
      name,
      version: Number(match[1]),
      system: raw.slice(match[0].length).trim(),
    };
    cache.set(name, template);
    return template;
  };
}
