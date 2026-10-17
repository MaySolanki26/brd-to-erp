import { withTransaction } from '../../lib/transaction.js';
import { llmService } from '../../services/llm/index.js';
import * as repo from './report.repository.js';
import { createReportGeneration } from './report.generation.js';

/** Report generation wired to the real database and the configured LLM driver (worker only). */
export const reportGeneration = createReportGeneration({
  repo,
  llm: llmService,
  transaction: withTransaction,
});
