import { withTransaction } from '../../lib/transaction.js';
import { llmService } from '../../services/llm/index.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './extraction.repository.js';
import { createExtractionService } from './extraction.service.js';

/** Extraction wired to the real database and the configured LLM driver. */
export const extractionService = createExtractionService({
  repo,
  llm: llmService,
  transaction: withTransaction,
  audit: createAuditLog,
});
