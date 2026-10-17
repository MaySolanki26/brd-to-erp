import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';
import { LlmConfigError, LlmRefusalError, LlmTransientError } from './llm.errors.js';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm.types.js';

/** The slice of the SDK client this provider needs, so tests can supply a fake. */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** The prompts refer to this block by name. */
export const CONTEXT_LABEL = 'PROJECT SUMMARY';

export type Effort = 'low' | 'medium' | 'high';

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function textOf(message: Anthropic.Message): string {
  return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
}

/** Maps SDK errors to errors the pipeline can act on, without echoing anything from the request. */
export function mapAnthropicError(err: unknown): Error {
  if (err instanceof Anthropic.APIConnectionError) {
    return new LlmTransientError();
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    if (status === 429 || (typeof status === 'number' && status >= 500)) {
      return new LlmTransientError();
    }
    if (status === 401 || status === 403) {
      return new LlmConfigError('The LLM credentials were rejected');
    }
    return new LlmConfigError('The LLM request was rejected');
  }
  return err instanceof Error ? err : new Error('Unknown LLM error');
}

export class AnthropicProvider implements LlmProvider {
  constructor(
    private readonly client: MessagesClient,
    private readonly model: string,
    private readonly effort: Effort,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxOutputTokens,
        // The instructions are identical for every call, and the project summary for every call of
        // one project, so each is cached as a prefix block.
        system: [
          { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
          ...(request.cachedContext
            ? [
                {
                  type: 'text' as const,
                  text: `${CONTEXT_LABEL}\n\n${request.cachedContext}`,
                  cache_control: { type: 'ephemeral' as const },
                },
              ]
            : []),
        ],
        messages: [{ role: 'user', content: request.user }],
        output_config: {
          effort: this.effort,
          format: { type: 'json_schema', schema: request.outputSchema },
        },
      });
    } catch (err) {
      logger.warn(
        { promptName: request.promptName, status: (err as { status?: number }).status },
        'LLM request failed',
      );
      throw mapAnthropicError(err);
    }

    if (message.stop_reason === 'refusal') {
      throw new LlmRefusalError();
    }

    const cached = message.usage.cache_read_input_tokens ?? 0;
    const uncachedInput = message.usage.input_tokens;
    const written = message.usage.cache_creation_input_tokens ?? 0;
    return {
      // A reply cut off by max_tokens is not valid JSON; `truncated` tells the caller why.
      json: message.stop_reason === 'max_tokens' ? undefined : tryParseJson(textOf(message)),
      ...(message.stop_reason === 'max_tokens' && { truncated: true }),
      usage: {
        inputTokens: uncachedInput + written + cached,
        outputTokens: message.usage.output_tokens,
        cachedTokens: cached,
      },
      model: message.model,
    };
  }
}
