import PgBoss from 'pg-boss';
import { JobName } from '@brd/shared';

export function createBoss(): PgBoss {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new PgBoss({
    connectionString,
    schema: 'pgboss',
  });
}

/** pg-boss 10 refuses to send or work on a queue that was never created. Safe to repeat. */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const name of Object.values(JobName)) {
    await boss.createQueue(name);
  }
}
