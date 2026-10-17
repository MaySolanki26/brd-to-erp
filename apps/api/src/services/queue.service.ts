import type PgBoss from 'pg-boss';
import { type JobName, type JobPayloadMap, DEFAULT_BACKOFF } from '@brd/shared';
import { createBoss, ensureQueues } from '../lib/boss.js';

export interface EnqueueOptions {
  /** Seconds to wait before the job may start. */
  startAfter?: number;
}

export async function enqueue<T extends JobName>(
  boss: PgBoss,
  name: T,
  data: JobPayloadMap[T],
  options: EnqueueOptions = {},
): Promise<string | null> {
  return boss.send(name, data, {
    retryLimit: DEFAULT_BACKOFF.retryLimit,
    retryDelay: DEFAULT_BACKOFF.retryDelay,
    retryBackoff: DEFAULT_BACKOFF.retryBackoff,
    ...(options.startAfter !== undefined && { startAfter: options.startAfter }),
  });
}

let sharedBoss: Promise<PgBoss> | undefined;

/** Starts one send-only pg-boss for the API process the first time a job is queued. */
function getSharedBoss(): Promise<PgBoss> {
  sharedBoss ??= (async () => {
    const boss = createBoss();
    await boss.start();
    await ensureQueues(boss);
    return boss;
  })();
  sharedBoss.catch(() => {
    sharedBoss = undefined;
  });
  return sharedBoss;
}

export async function enqueueJob<T extends JobName>(
  name: T,
  data: JobPayloadMap[T],
): Promise<string | null> {
  return enqueue(await getSharedBoss(), name, data);
}

export async function stopQueue(): Promise<void> {
  if (!sharedBoss) return;
  const boss = await sharedBoss.catch(() => undefined);
  sharedBoss = undefined;
  await boss?.stop({ graceful: true, timeout: 5_000 });
}
