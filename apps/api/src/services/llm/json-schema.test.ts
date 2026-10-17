import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  applyAnswerLlmOutputSchema,
  questionsLlmOutputSchema,
  summaryLlmOutputSchema,
} from '@brd/shared';
import { providerJsonSchema } from './json-schema.js';

function keywordsIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => keywordsIn(n, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.add(key);
      if (key === 'properties') {
        Object.values(value as object).forEach((n) => keywordsIn(n, found));
      } else keywordsIn(value, found);
    }
  }
  return found;
}

describe('providerJsonSchema', () => {
  it.each([
    ['summary', summaryLlmOutputSchema],
    ['questions', questionsLlmOutputSchema],
    ['apply-answer', applyAnswerLlmOutputSchema],
  ])('produces a closed schema without unsupported keywords for %s', (_name, schema) => {
    const json = providerJsonSchema(schema);
    expect(json['type']).toBe('object');
    expect(json['additionalProperties']).toBe(false);
    const found = keywordsIn(json);
    for (const banned of ['$schema', 'format', 'pattern', 'minLength', 'minItems', 'maxItems']) {
      expect(found.has(banned)).toBe(false);
    }
  });

  it('keeps required fields and enum values', () => {
    const json = providerJsonSchema(questionsLlmOutputSchema) as {
      properties: {
        questions: { items: { required: string[]; properties: Record<string, unknown> } };
      };
    };
    const item = json.properties.questions.items;
    expect(item.required).toEqual(
      expect.arrayContaining(['reason', 'priority', 'text', 'moduleId', 'linkedItems']),
    );
    expect(JSON.stringify(item.properties['reason'])).toContain('MISSING_RULE');
  });

  it('does not drop a property that happens to be named like a keyword', () => {
    const json = providerJsonSchema(z.object({ format: z.string(), default: z.string() })) as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(json.properties).sort()).toEqual(['default', 'format']);
  });
});
