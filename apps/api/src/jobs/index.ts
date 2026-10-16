import type PgBoss from 'pg-boss';
import { JobName } from '@brd/shared';
import { logger } from '../lib/logger.js';
import { handleProcessSource } from './process-source.handler.js';

export async function registerAllHandlers(boss: PgBoss): Promise<void> {
  await boss.work(JobName.PROCESS_SOURCE, { includeMetadata: true }, handleProcessSource);

  logger.info({ job: JobName.PROCESS_SOURCE }, 'Registered worker handler');
}
