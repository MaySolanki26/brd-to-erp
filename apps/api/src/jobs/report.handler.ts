import type PgBoss from 'pg-boss';
import { JobName, type GenerateReportPayload } from '@brd/shared';
import { logger } from '../lib/logger.js';
import type { ReportGeneration } from '../modules/report/report.generation.js';
import {
  LlmBudgetExceededError,
  LlmConfigError,
  LlmOutputTooLongError,
  LlmRefusalError,
} from '../services/llm/llm.errors.js';
import { guarded } from './understanding.handlers.js';

export const REPORT_FAILED = 'The report could not be written. Try generating it again.';
export const REPORT_TOO_LONG = 'The report was too long for the AI to write. Contact support.';
export const REPORT_AI_UNAVAILABLE = 'The AI service is not available. Try again later.';

export function createReportHandler(boss: PgBoss, service: ReportGeneration) {
  /**
   * A used-up budget pauses the job (the version stays GENERATING). A model that is misconfigured or
   * refuses the input will not improve with retries, so the version fails now; any other error is
   * retried, and fails the version after the last retry so nobody waits on it forever.
   */
  async function run(job: PgBoss.JobWithMetadata<GenerateReportPayload>): Promise<void> {
    try {
      await service.generateContent(job.data);
    } catch (err) {
      if (err instanceof LlmBudgetExceededError) throw err;
      if (err instanceof LlmConfigError || err instanceof LlmRefusalError) {
        await service.failGeneration(job.data, REPORT_AI_UNAVAILABLE);
        throw err;
      }
      if (err instanceof LlmOutputTooLongError) {
        await service.failGeneration(job.data, REPORT_TOO_LONG);
        throw err;
      }
      if (job.retryCount < job.retryLimit) throw err;
      logger.error({ err, jobId: job.id }, 'Report generation gave up');
      await service.failGeneration(job.data, REPORT_FAILED);
    }
  }

  return async (jobs: PgBoss.JobWithMetadata<GenerateReportPayload>[]): Promise<void> => {
    for (const job of jobs) {
      await guarded(boss, JobName.GENERATE_REPORT, job, () => run(job));
    }
  };
}
