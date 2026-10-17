import { JobName } from '@brd/shared';
import { withTransaction } from '../../lib/transaction.js';
import { enqueueJob } from '../../services/queue.service.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './report.repository.js';
import { createReportService } from './report.service.js';

/** The report API wired to the real database and queue. */
export const reportService = createReportService({
  repo,
  transaction: withTransaction,
  audit: createAuditLog,
  enqueueGeneration: async (payload) => {
    await enqueueJob(JobName.GENERATE_REPORT, payload);
  },
});
