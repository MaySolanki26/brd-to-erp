import PgBoss from 'pg-boss';

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
