import type PgBoss from 'pg-boss';
import { JobName, type JobPayloadMap } from '@brd/shared';
import { logger } from '../lib/logger.js';
import type { UnderstandingService } from '../modules/understanding/understanding.service.js';
import {
  LlmBudgetExceededError,
  LlmConfigError,
  LlmRefusalError,
} from '../services/llm/llm.errors.js';
import { enqueue } from '../services/queue.service.js';

/** When a project's monthly token budget is used up, its LLM jobs wait this long before trying again. */
export const BUDGET_RETRY_SECONDS = 60 * 60;

type UnderstandingJob =
  typeof JobName.REFRESH_SUMMARY | typeof JobName.GENERATE_QUESTIONS | typeof JobName.APPLY_ANSWER;
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
async function guarded<N extends UnderstandingJob>(
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
    if (err instanceof LlmConfigError || err instanceof LlmRefusalError) {
      log.error({ err }, 'The LLM cannot handle this job, not retrying');
      return;
    }
    throw err;
  }
}

export function createUnderstandingHandlers(
  boss: PgBoss,
  service: UnderstandingService,
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
          await service.generateQuestions(job.data);
        });
      }
    },
    async applyAnswer(jobs) {
      for (const job of jobs) {
        await guarded(boss, JobName.APPLY_ANSWER, job, async () => {
          const outcome = await service.applyAnswer(job.data);
          if (outcome.status === 'applied') {
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
