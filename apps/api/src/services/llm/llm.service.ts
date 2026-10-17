import type { LlmCallStatus } from '@prisma/client';
import type { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { startOfUtcMonth } from './budget.js';
import {
  InvalidLlmOutputError,
  LlmBudgetExceededError,
  LlmOutputTooLongError,
  LlmRefusalError,
} from './llm.errors.js';
import { OUTPUT_TOKENS_CEILING } from './output-limits.js';
import type { LlmProvider, LlmRequest, LlmResponse, LlmTokenUsage } from './llm.types.js';
import type { NewLlmUsage } from './llm-usage.repository.js';
import type { PromptTemplate } from './prompt-loader.js';

export interface LlmContext {
  organizationId: string;
  projectId: string;
  userId?: string | undefined;
}

export interface LlmRunOptions<T> {
  promptName: string;
  /** Project-wide context that stays the same across calls (the project summary); cached. */
  cachedContext?: string | undefined;
  /** The untrusted, variable part of the prompt. */
  user: string;
  /** Zod schema the answer is validated against. */
  schema: z.ZodType<T>;
  /** The same shape as JSON Schema, sent to the provider. */
  outputJsonSchema: Record<string, unknown>;
  context: LlmContext;
  /** Room for a longer answer than the default; never lower than the default. */
  maxOutputTokens?: number | undefined;
}

export interface LlmRunResult<T> {
  output: T;
  usage: LlmTokenUsage;
}

export interface LlmServiceDeps {
  provider: LlmProvider;
  loadPrompt: (name: string) => PromptTemplate;
  usage: {
    record: (data: NewLlmUsage) => Promise<void>;
    tokensUsedSince: (organizationId: string, projectId: string, since: Date) => Promise<number>;
  };
  monthlyTokenBudget: number;
  maxOutputTokens: number;
  now?: () => Date;
}

const NO_USAGE: LlmTokenUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

/**
 * The only door to an LLM. It enforces the project's monthly budget, retries once when the
 * answer is not valid, and records token usage for every call without ever storing content.
 */
export function createLlmService(deps: LlmServiceDeps) {
  const now = deps.now ?? (() => new Date());

  async function assertWithinBudget(context: LlmContext): Promise<void> {
    const used = await deps.usage.tokensUsedSince(
      context.organizationId,
      context.projectId,
      startOfUtcMonth(now()),
    );
    if (used >= deps.monthlyTokenBudget) {
      throw new LlmBudgetExceededError(used, deps.monthlyTokenBudget);
    }
  }

  async function record(
    context: LlmContext,
    promptName: string,
    model: string,
    usage: LlmTokenUsage,
    latencyMs: number,
    status: LlmCallStatus,
  ): Promise<void> {
    await deps.usage.record({
      organizationId: context.organizationId,
      projectId: context.projectId,
      userId: context.userId,
      model,
      promptName,
      promptTokens: usage.inputTokens,
      completionTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      latencyMs,
      status,
    });
  }

  async function callProvider(
    request: LlmRequest,
    context: LlmContext,
  ): Promise<{ response: LlmResponse; latencyMs: number }> {
    const started = Date.now();
    try {
      const response = await deps.provider.complete(request);
      return { response, latencyMs: Date.now() - started };
    } catch (err) {
      const status: LlmCallStatus = err instanceof LlmRefusalError ? 'REFUSED' : 'ERROR';
      await record(context, request.promptName, 'unknown', NO_USAGE, Date.now() - started, status);
      throw err;
    }
  }

  async function run<T>(options: LlmRunOptions<T>): Promise<LlmRunResult<T>> {
    const { context } = options;
    const prompt = deps.loadPrompt(options.promptName);
    let request: LlmRequest = {
      promptName: prompt.name,
      promptVersion: prompt.version,
      system: prompt.system,
      cachedContext: options.cachedContext,
      user: options.user,
      outputSchema: options.outputJsonSchema,
      maxOutputTokens: Math.min(
        Math.max(deps.maxOutputTokens, options.maxOutputTokens ?? 0),
        OUTPUT_TOKENS_CEILING,
      ),
    };

    await assertWithinBudget(context);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { response, latencyMs } = await callProvider(request, context);
      const parsed = options.schema.safeParse(response.json);

      if (parsed.success) {
        await record(context, prompt.name, response.model, response.usage, latencyMs, 'OK');
        return { output: parsed.data, usage: response.usage };
      }

      await record(
        context,
        prompt.name,
        response.model,
        response.usage,
        latencyMs,
        'INVALID_OUTPUT',
      );
      logger.warn(
        {
          promptName: prompt.name,
          attempt,
          projectId: context.projectId,
          issueCount: parsed.error.issues.length,
          truncated: response.truncated === true,
          outputTokens: response.usage.outputTokens,
          maxOutputTokens: request.maxOutputTokens,
        },
        'LLM output failed validation',
      );

      if (response.truncated) {
        // The same request would be cut off again: give the answer more room, or stop at the ceiling.
        if (attempt === 2 || request.maxOutputTokens >= OUTPUT_TOKENS_CEILING) {
          throw new LlmOutputTooLongError(request.maxOutputTokens);
        }
        request = {
          ...request,
          maxOutputTokens: Math.min(request.maxOutputTokens * 2, OUTPUT_TOKENS_CEILING),
        };
      }
    }

    throw new InvalidLlmOutputError();
  }

  return { run };
}

export type LlmService = ReturnType<typeof createLlmService>;
