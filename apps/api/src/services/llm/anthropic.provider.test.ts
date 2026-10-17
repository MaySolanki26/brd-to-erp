import Anthropic from '@anthropic-ai/sdk';
import { describe, it, expect, vi } from 'vitest';
import { AnthropicProvider, mapAnthropicError, type MessagesClient } from './anthropic.provider.js';
import { LlmConfigError, LlmRefusalError, LlmTransientError } from './llm.errors.js';
import type { LlmRequest } from './llm.types.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

const request: LlmRequest = {
  promptName: 'extraction',
  promptVersion: 1,
  system: 'Be precise.',
  user: '<chunk>text</chunk>',
  outputSchema: {
    type: 'object',
    properties: { a: { type: 'string' } },
    additionalProperties: false,
  },
  maxOutputTokens: 2048,
};

function message(overrides: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: '{"a":"b"}', citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    ...overrides,
  } as Anthropic.Message;
}

function clientReturning(result: Anthropic.Message | Error) {
  const create = vi.fn(async (_params: Anthropic.MessageCreateParamsNonStreaming) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const client: MessagesClient = { messages: { create } };
  return { client, create };
}

describe('AnthropicProvider', () => {
  it('asks for schema-constrained JSON with cached instructions and no forced tool use', async () => {
    const { client, create } = clientReturning(message());
    await new AnthropicProvider(client, 'claude-sonnet-5-5', 'medium').complete(request);

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock
      .calls[0]?.[0] as unknown as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.max_tokens).toBe(2048);
    expect(params.system).toEqual([
      { type: 'text', text: 'Be precise.', cache_control: { type: 'ephemeral' } },
    ]);
    expect(params.messages).toEqual([{ role: 'user', content: '<chunk>text</chunk>' }]);
    expect(params.output_config).toEqual({
      effort: 'medium',
      format: { type: 'json_schema', schema: request.outputSchema },
    });
    expect(params).not.toHaveProperty('tool_choice');
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('thinking');
  });

  it('sends the project summary as a second cached block, after the instructions', async () => {
    const { client, create } = clientReturning(message());
    await new AnthropicProvider(client, 'claude-sonnet-5-5', 'low').complete({
      ...request,
      cachedContext: '{"overview":"Billing"}',
    });
    const params = create.mock
      .calls[0]?.[0] as unknown as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.system).toEqual([
      { type: 'text', text: 'Be precise.', cache_control: { type: 'ephemeral' } },
      {
        type: 'text',
        text: 'PROJECT SUMMARY\n\n{"overview":"Billing"}',
        cache_control: { type: 'ephemeral' },
      },
    ]);
    expect(params.messages).toEqual([{ role: 'user', content: '<chunk>text</chunk>' }]);
  });

  it('returns parsed JSON and the model that answered', async () => {
    const { client } = clientReturning(message());
    const response = await new AnthropicProvider(client, 'm', 'low').complete(request);
    expect(response.json).toEqual({ a: 'b' });
    expect(response.model).toBe('claude-sonnet-5-5');
  });

  it('counts cached and newly cached tokens as input', async () => {
    const { client } = clientReturning(
      message({
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_creation_input_tokens: 30,
          cache_read_input_tokens: 60,
        } as Anthropic.Usage,
      }),
    );
    const { usage } = await new AnthropicProvider(client, 'm', 'low').complete(request);
    expect(usage).toEqual({ inputTokens: 100, outputTokens: 5, cachedTokens: 60 });
  });

  it('treats text that is not JSON, or a reply cut off by max_tokens, as no JSON', async () => {
    const text = message({
      content: [{ type: 'text', text: 'Sure! Here you go', citations: null }],
    });
    expect(
      (await new AnthropicProvider(clientReturning(text).client, 'm', 'low').complete(request))
        .json,
    ).toBeUndefined();

    const truncated = message({ stop_reason: 'max_tokens' });
    expect(
      (await new AnthropicProvider(clientReturning(truncated).client, 'm', 'low').complete(request))
        .json,
    ).toBeUndefined();
  });

  it('turns a refusal into a LlmRefusalError', async () => {
    const refused = message({ stop_reason: 'refusal' });
    await expect(
      new AnthropicProvider(clientReturning(refused).client, 'm', 'low').complete(request),
    ).rejects.toBeInstanceOf(LlmRefusalError);
  });

  it('maps SDK failures without exposing request or provider details', async () => {
    const failing = (status: number) =>
      new AnthropicProvider(
        clientReturning(
          Anthropic.APIError.generate(
            status,
            { error: { message: 'secret detail' } },
            'secret detail',
            new Headers(),
          ) as Error,
        ).client,
        'm',
        'low',
      ).complete(request);

    await expect(failing(401)).rejects.toThrow(/credentials were rejected/);
    await expect(failing(403)).rejects.toBeInstanceOf(LlmConfigError);
    await expect(failing(400)).rejects.toBeInstanceOf(LlmConfigError);
    await expect(failing(404)).rejects.toBeInstanceOf(LlmConfigError);
    for (const transient of [429, 500, 529]) {
      await expect(failing(transient)).rejects.toBeInstanceOf(LlmTransientError);
    }
    const error = (await failing(401).catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain('secret detail');
  });
});

describe('mapAnthropicError', () => {
  it('treats connection problems as transient and keeps unknown errors as they are', () => {
    expect(mapAnthropicError(new Anthropic.APIConnectionError({ message: 'down' }))).toBeInstanceOf(
      LlmTransientError,
    );
    const plain = new Error('boom');
    expect(mapAnthropicError(plain)).toBe(plain);
  });
});
