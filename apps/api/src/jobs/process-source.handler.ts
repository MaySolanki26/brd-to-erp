import type PgBoss from 'pg-boss';
import { JobName, type ProcessSourcePayload } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { failSource, processSource } from '../modules/sources/process-source.service.js';
import { enqueue } from '../services/queue.service.js';

const EXTRACTION_NOT_QUEUED = 'Could not start reading the text. Try reprocessing.';

export function createProcessSourceHandler(boss: PgBoss) {
  async function queueExtraction(payload: ProcessSourcePayload, chunkIds: string[]): Promise<void> {
    const { organizationId, projectId } = payload;
    try {
      for (const chunkId of chunkIds) {
        await enqueue(boss, JobName.EXTRACT_CHUNK, { organizationId, projectId, chunkId });
      }
    } catch (err) {
      // Retrying this job cannot help: the source is already past its claim. Fail it so a person can
      // reprocess, instead of leaving it processing forever.
      logger.error({ err, projectId, sourceId: payload.sourceId }, 'Could not queue extraction');
      await failSource(payload, EXTRACTION_NOT_QUEUED);
    }
  }

  return async function handleProcessSource(
    jobs: PgBoss.JobWithMetadata<ProcessSourcePayload>[],
  ): Promise<void> {
    for (const job of jobs) {
      const { outcome, chunkIds } = await processSource(job.data, {
        jobId: job.id,
        isLastAttempt: job.retryCount >= job.retryLimit,
      });

      if (outcome === 'extracting') {
        await queueExtraction(job.data, chunkIds);
        continue;
      }
      if (outcome !== 'processed') continue;

      // Nothing to read means the source is done: new text may still change the summary.
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
