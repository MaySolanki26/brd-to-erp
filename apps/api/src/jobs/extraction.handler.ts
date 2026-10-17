import type PgBoss from 'pg-boss';
import { JobName, type ExtractChunkPayload } from '@brd/shared';
import { logger } from '../lib/logger.js';
import {
  LlmBudgetExceededError,
  LlmConfigError,
  LlmOutputTooLongError,
} from '../services/llm/llm.errors.js';
import type { ExtractionService } from '../modules/extraction/extraction.service.js';
import { enqueue } from '../services/queue.service.js';
import { guarded, notifyItemsChanged, type ItemsChanged } from './understanding.handlers.js';

/** One summary refresh per project per window, however many chunks finish in a burst. */
export const SUMMARY_REFRESH_WINDOW_SECONDS = 30;

export const AI_UNAVAILABLE = 'The AI service is not available. Try reprocessing later.';

export function createExtractionHandler(
  boss: PgBoss,
  service: ExtractionService,
  onItemsChanged?: ItemsChanged,
) {
  /**
   * Runs one chunk. A budget error goes up to `guarded`, which pauses the job. A misconfigured model
   * fails the source so it can be reprocessed after the fix. Any other error is retried by pg-boss;
   * after the last retry the chunk is flagged for review so its source can still finish.
   */
  async function runChunk(job: PgBoss.JobWithMetadata<ExtractChunkPayload>) {
    try {
      return await service.extractChunk(job.data);
    } catch (err) {
      if (err instanceof LlmBudgetExceededError) throw err;
      if (err instanceof LlmConfigError) {
        await service.failSource(job.data, AI_UNAVAILABLE);
        return undefined;
      }
      // The same chunk would be cut off again, so flag it for review now instead of retrying.
      if (err instanceof LlmOutputTooLongError) return service.giveUp(job.data);
      if (job.retryCount < job.retryLimit) throw err;
      logger.error({ err, jobId: job.id, chunkId: job.data.chunkId }, 'Extraction gave up');
      return service.giveUp(job.data);
    }
  }

  return async (jobs: PgBoss.JobWithMetadata<ExtractChunkPayload>[]): Promise<void> => {
    for (const job of jobs) {
      await guarded(boss, JobName.EXTRACT_CHUNK, job, async () => {
        const outcome = await runChunk(job);
        if (!outcome || outcome.status === 'skipped' || !outcome.sourceFinished) return;

        // New knowledge may change the summary, which then asks its questions. The source is already
        // processed, so a failure here must not fail (and re-run) this job.
        const { organizationId, projectId } = job.data;
        await notifyItemsChanged(organizationId, projectId, onItemsChanged);
        try {
          await enqueue(
            boss,
            JobName.REFRESH_SUMMARY,
            { organizationId, projectId },
            {
              singletonKey: `refresh-summary:${projectId}`,
              singletonSeconds: SUMMARY_REFRESH_WINDOW_SECONDS,
            },
          );
        } catch (err) {
          logger.warn({ err, jobId: job.id, projectId }, 'Could not queue summary refresh');
        }
      });
    }
  };
}
