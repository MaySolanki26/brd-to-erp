/**
 * How many tokens a model answer may have, per prompt. The default (LLM_MAX_OUTPUT_TOKENS) suits
 * short answers such as extraction; these prompts list every module or many questions, whose ids
 * are expensive to write out, so they need more room.
 */
export const SUMMARY_MAX_OUTPUT_TOKENS = 16_000;
export const QUESTIONS_MAX_OUTPUT_TOKENS = 8_000;
export const REPORT_MAX_OUTPUT_TOKENS = 6_000;
/** An answer cut off at its limit is retried with a doubled limit, up to this ceiling. */
export const OUTPUT_TOKENS_CEILING = 32_000;
