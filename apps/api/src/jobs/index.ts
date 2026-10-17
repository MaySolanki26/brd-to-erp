import type PgBoss from 'pg-boss';
import { JobName } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { understandingService } from '../modules/understanding/understanding.runtime.js';
import { createProcessSourceHandler } from './process-source.handler.js';
import { createUnderstandingHandlers } from './understanding.handlers.js';

export async function registerAllHandlers(boss: PgBoss): Promise<void> {
  const understanding = createUnderstandingHandlers(boss, understandingService);

  await boss.work(
    JobName.PROCESS_SOURCE,
    { includeMetadata: true },
    createProcessSourceHandler(boss),
  );
  await boss.work(JobName.REFRESH_SUMMARY, { includeMetadata: true }, understanding.refreshSummary);
  await boss.work(
    JobName.GENERATE_QUESTIONS,
    { includeMetadata: true },
    understanding.generateQuestions,
  );
  await boss.work(JobName.APPLY_ANSWER, { includeMetadata: true }, understanding.applyAnswer);

  logger.info({ jobs: Object.values(JobName) }, 'Registered worker handlers');
}
