import type PgBoss from 'pg-boss';
import type { ProcessSourcePayload } from '@brd/shared';
import { processSource } from '../modules/sources/process-source.service.js';

export async function handleProcessSource(
  jobs: PgBoss.JobWithMetadata<ProcessSourcePayload>[],
): Promise<void> {
  for (const job of jobs) {
    await processSource(job.data, {
      jobId: job.id,
      isLastAttempt: job.retryCount >= job.retryLimit,
    });
  }
}
