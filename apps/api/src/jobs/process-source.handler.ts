import type PgBoss from 'pg-boss';
import { JobName, type ProcessSourcePayload } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { processSource } from '../modules/sources/process-source.service.js';
import { enqueue } from '../services/queue.service.js';

export function createProcessSourceHandler(boss: PgBoss) {
  return async function handleProcessSource(
    jobs: PgBoss.JobWithMetadata<ProcessSourcePayload>[],
  ): Promise<void> {
    for (const job of jobs) {
      const outcome = await processSource(job.data, {
        jobId: job.id,
        isLastAttempt: job.retryCount >= job.retryLimit,
      });
      if (outcome !== 'processed') continue;

      // New text may mean new knowledge: refresh the project summary, which then asks its questions.
      // The source is already processed, so a failure here must not fail (and re-run) this job.
      try {
        await enqueue(boss, JobName.REFRESH_SUMMARY, {
          organizationId: job.data.organizationId,
          projectId: job.data.projectId,
        });
      } catch (err) {
        logger.warn(
          { err, jobId: job.id, projectId: job.data.projectId },
          'Could not queue summary refresh',
        );
      }
    }
  };
}
