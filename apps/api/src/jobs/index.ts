import type PgBoss from 'pg-boss';
import { JobName } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { extractionService } from '../modules/extraction/extraction.runtime.js';
import { reportGeneration } from '../modules/report/report.generation.runtime.js';
import { reportService } from '../modules/report/report.runtime.js';
import { understandingService } from '../modules/understanding/understanding.runtime.js';
import { createExtractionHandler } from './extraction.handler.js';
import { createProcessSourceHandler } from './process-source.handler.js';
import { createReportHandler } from './report.handler.js';
import { createUnderstandingHandlers } from './understanding.handlers.js';

export async function registerAllHandlers(boss: PgBoss): Promise<void> {
  const markReportsOutdated = async (organizationId: string, projectId: string) => {
    await reportService.refreshOutdated(organizationId, projectId);
  };
  const understanding = createUnderstandingHandlers(
    boss,
    understandingService,
    markReportsOutdated,
  );

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
  await boss.work(
    JobName.EXTRACT_CHUNK,
    { includeMetadata: true },
    createExtractionHandler(boss, extractionService, markReportsOutdated),
  );
  await boss.work(
    JobName.GENERATE_REPORT,
    { includeMetadata: true },
    createReportHandler(boss, reportGeneration),
  );

  logger.info({ jobs: Object.values(JobName) }, 'Registered worker handlers');
}
