export interface LlmRequest {
  promptName: string;
  promptVersion: number;
  /** Static instructions; identical across calls so the provider can cache them. */
  system: string;
  /**
   * Shared context that is identical across the calls of one project (the project summary).
   * Sent as a second cached block after the instructions, so repeated calls read it from the cache.
   */
  cachedContext?: string | undefined;
  /** The variable part: always untrusted data wrapped by the caller. */
  user: string;
  /** JSON Schema the answer must follow. */
  outputSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface LlmTokenUsage {
  /** All prompt tokens, including cached ones. */
  inputTokens: number;
  outputTokens: number;
  /** The part of inputTokens served from the prompt cache. */
  cachedTokens: number;
}

export interface LlmResponse {
  /** Parsed JSON, or undefined when the model's text was not valid JSON. */
  json: unknown;
  usage: LlmTokenUsage;
  model: string;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
