import { AppError } from '../../errors/app-error.js';

/** The LLM is unusable until someone fixes configuration (key, model, request shape). Never retry. */
export class LlmConfigError extends AppError {
  constructor(message = 'The LLM is not configured correctly') {
    super(503, 'SERVICE_UNAVAILABLE', message);
    this.name = 'LlmConfigError';
  }
}

/** The provider is busy or unreachable. Retrying later may work. */
export class LlmTransientError extends AppError {
  constructor(message = 'The LLM provider is temporarily unavailable') {
    super(503, 'SERVICE_UNAVAILABLE', message);
    this.name = 'LlmTransientError';
  }
}

export class LlmBudgetExceededError extends AppError {
  constructor(
    public readonly used: number,
    public readonly budget: number,
  ) {
    super(429, 'LLM_BUDGET_EXCEEDED', 'The monthly LLM token budget for this project is used up');
    this.name = 'LlmBudgetExceededError';
  }
}

/** The model answered, but not in the shape the prompt demands, even after one retry. */
export class InvalidLlmOutputError extends AppError {
  constructor(message = 'The LLM returned output that could not be used') {
    super(502, 'LLM_INVALID_OUTPUT', message);
    this.name = 'InvalidLlmOutputError';
  }
}

/** The provider declined to answer this input. Retrying the same input will not help. */
export class LlmRefusalError extends AppError {
  constructor(message = 'The LLM declined to process this input') {
    super(502, 'LLM_REFUSED', message);
    this.name = 'LlmRefusalError';
  }
}

/** Fixture driver has no recorded answer for this exact input. */
export class FixtureMissingError extends LlmConfigError {
  constructor(promptName: string, hash: string) {
    super(
      `No recorded LLM response for "${promptName}" (input ${hash.slice(0, 12)}). ` +
        'Record one with LLM_DRIVER=real and LLM_RECORD_FIXTURES=true.',
    );
    this.name = 'FixtureMissingError';
  }
}
