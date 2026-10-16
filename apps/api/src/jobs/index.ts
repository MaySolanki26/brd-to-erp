import type PgBoss from 'pg-boss';
import { JobName } from '@brd/shared';
import { handleProcessDocument } from './process-document.handler.js';

export async function registerAllHandlers(boss: PgBoss): Promise<void> {
  await boss.work(JobName.PROCESS_DOCUMENT, handleProcessDocument);

  console.log('[worker] Registered handler: process-document');
}
