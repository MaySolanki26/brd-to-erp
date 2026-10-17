import type PgBoss from 'pg-boss';
import { JobName, type JobPayloadMap } from '@brd/shared';
import { logger } from '../lib/logger.js';
import type { UnderstandingService } from '../modules/understanding/understanding.service.js';
import {
  LlmBudgetExceededError,
  LlmConfigError,
  LlmOutputTooLongError,
  LlmRefusalError,
} from '../services/llm/llm.errors.js';
import { enqueue } from '../services/queue.service.js';

/** When a project's monthly token budget is used up, its LLM jobs wait this long before trying again. */
export const BUDGET_RETRY_SECONDS = 60 * 60;

type UnderstandingJob =
  typeof JobName.REFRESH_SUMMARY | typeof JobName.GENERATE_QUESTIONS | typeof JobName.APPLY_ANSWER;
/** Every job that calls the model goes through `guarded`. */
export type LlmJob =
  UnderstandingJob | typeof JobName.EXTRACT_CHUNK | typeof JobName.GENERATE_REPORT;
type Jobs<N extends UnderstandingJob> = PgBoss.JobWithMetadata<JobPayloadMap[N]>[];

export interface UnderstandingHandlers {
  refreshSummary: (jobs: Jobs<typeof JobName.REFRESH_SUMMARY>) => Promise<void>;
  generateQuestions: (jobs: Jobs<typeof JobName.GENERATE_QUESTIONS>) => Promise<void>;
  applyAnswer: (jobs: Jobs<typeof JobName.APPLY_ANSWER>) => Promise<void>;
}

/**
 * Runs one job, sorting its failures: a used-up budget pauses the job and tries again later; a model
 * that is misconfigured or refuses the input will not improve by retrying; anything else is retried
 * by pg-boss with backoff.
 */
export async function guarded<N extends LlmJob>(
  boss: PgBoss,
  name: N,
  job: PgBoss.JobWithMetadata<JobPayloadMap[N]>,
  work: () => Promise<void>,
): Promise<void> {
  const log = logger.child({
    job: name,
    jobId: job.id,
    organizationId: job.data.organizationId,
    projectId: job.data.projectId,
  });
  try {
    await work();
  } catch (err) {
    if (err instanceof LlmBudgetExceededError) {
      log.warn({ used: err.used, budget: err.budget }, 'LLM budget used up, job paused');
      await enqueue(boss, name, job.data, { startAfter: BUDGET_RETRY_SECONDS });
      return;
    }
    if (
      err instanceof LlmConfigError ||
      err instanceof LlmRefusalError ||
      err instanceof LlmOutputTooLongError
    ) {
      log.error({ err }, 'The LLM cannot handle this job, not retrying');
      return;
    }
    throw err;
  }
}

/**
 * Tells the reports the items changed. The change is already saved, so a failure here must not
 * fail (and re-run) the job; reads check again anyway.
 */
export async function notifyItemsChanged(
  organizationId: string,
  projectId: string,
  onItemsChanged: ItemsChanged | undefined,
): Promise<void> {
  if (!onItemsChanged) return;
  try {
    await onItemsChanged(organizationId, projectId);
  } catch (err) {
    logger.warn({ err, projectId }, 'Could not refresh report state');
  }
}

/** Called once the project's items have changed, so approved reports can be marked OUTDATED. */
export type ItemsChanged = (organizationId: string, projectId: string) => Promise<void>;

export function createUnderstandingHandlers(
  boss: PgBoss,
  service: UnderstandingService,
  onItemsChanged?: ItemsChanged,
): UnderstandingHandlers {
  return {
    async refreshSummary(jobs) {
      for (const job of jobs) {
        await guarded(boss, JobName.REFRESH_SUMMARY, job, async () => {
          const outcome = await service.refreshSummary(job.data);
          // Questions follow a changed summary; an unchanged one has nothing new to ask about.
          if (outcome === 'created') {
            await enqueue(boss, JobName.GENERATE_QUESTIONS, {
              organizationId: job.data.organizationId,
              projectId: job.data.projectId,
            });
          }
        });
      }
    },
    async generateQuestions(jobs) {
      for (const job of jobs) {
        await guarded(boss, JobName.GENERATE_QUESTIONS, job, async () => {
          const outcome = await service.generateQuestions(job.data);
          // A long project is read in batches: the next one starts where this one ended.
          if (outcome.status === 'generated' && outcome.nextOffset !== null) {
            await enqueue(boss, JobName.GENERATE_QUESTIONS, {
              organizationId: job.data.organizationId,
              projectId: job.data.projectId,
              offset: outcome.nextOffset,
            });
          }
        });
      }
    },
    async applyAnswer(jobs) {
      for (const job of jobs) {
        await guarded(boss, JobName.APPLY_ANSWER, job, async () => {
          const outcome = await service.applyAnswer(job.data);
          if (outcome.status === 'applied') {
            await notifyItemsChanged(job.data.organizationId, job.data.projectId, onItemsChanged);
            await enqueue(boss, JobName.REFRESH_SUMMARY, {
              organizationId: job.data.organizationId,
              projectId: job.data.projectId,
            });
          }
        });
      }
    },
  };
}
