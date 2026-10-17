import { createHash } from 'node:crypto';
import type { LlmRequest } from './llm.types.js';

/**
 * Identifies an LLM input. The model is left out so recorded answers survive a model change;
 * the prompt version is in, so editing a prompt invalidates its recordings.
 */
export function fixtureHash(
  request: Pick<LlmRequest, 'promptName' | 'promptVersion' | 'system' | 'user' | 'cachedContext'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        p: request.promptName,
        v: request.promptVersion,
        s: request.system,
        u: request.user,
        // Only present when used, so recordings made without a context keep their hash.
        ...(request.cachedContext ? { c: request.cachedContext } : {}),
      }),
    )
    .digest('hex');
}
