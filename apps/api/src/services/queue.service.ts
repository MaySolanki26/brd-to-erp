import type PgBoss from 'pg-boss';
import { type JobName, type JobPayloadMap, DEFAULT_BACKOFF } from '@brd/shared';

export async function enqueue<T extends JobName>(
  boss: PgBoss,
  name: T,
  data: JobPayloadMap[T],
): Promise<string | null> {
  return boss.send(name, data, {
    retryLimit: DEFAULT_BACKOFF.retryLimit,
    retryDelay: DEFAULT_BACKOFF.retryDelay,
    retryBackoff: DEFAULT_BACKOFF.retryBackoff,
  });
}
