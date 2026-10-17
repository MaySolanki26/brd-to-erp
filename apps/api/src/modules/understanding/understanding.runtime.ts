import { withTransaction } from '../../lib/transaction.js';
import { llmService } from '../../services/llm/index.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './understanding.repository.js';
import { createUnderstandingService } from './understanding.service.js';

/** The understanding jobs wired to the real database and the configured LLM driver. */
export const understandingService = createUnderstandingService({
  repo,
  llm: llmService,
  transaction: withTransaction,
  audit: createAuditLog,
});
