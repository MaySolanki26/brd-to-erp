import { z } from 'zod';

// Keywords the provider's structured-output mode rejects. The answer is validated with Zod afterwards,
// so dropping them loses no safety.
const UNSUPPORTED = new Set([
  '$schema',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'default',
]);

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== 'object') return node;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.has(key)) continue;
    if (key === 'properties' && value !== null && typeof value === 'object') {
      // Property names are data, not keywords: keep them all, clean only their schemas.
      result[key] = Object.fromEntries(
        Object.entries(value).map(([name, schema]) => [name, clean(schema)]),
      );
    } else {
      result[key] = clean(value);
    }
  }
  return result;
}

/** The JSON Schema sent to the provider for a Zod schema: closed objects, no unsupported keywords. */
export function providerJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return clean(z.toJSONSchema(schema, { io: 'output' })) as Record<string, unknown>;
}
