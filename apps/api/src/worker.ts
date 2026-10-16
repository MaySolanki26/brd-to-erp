import { createBoss } from './lib/boss.js';
import { disconnectPrisma } from './lib/prisma.js';
import { registerAllHandlers } from './jobs/index.js';

async function main(): Promise<void> {
  const boss = createBoss();

  await boss.start();
  console.log('[worker] pg-boss started');

  await registerAllHandlers(boss);
  console.log('[worker] Ready — waiting for jobs');

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] Received ${signal}, shutting down gracefully...`);

    try {
      await boss.stop({ graceful: true, timeout: 30_000 });
      console.log('[worker] pg-boss stopped');
    } catch (err) {
      console.error('[worker] Error stopping pg-boss:', err);
    }

    try {
      await disconnectPrisma();
      console.log('[worker] Prisma disconnected');
    } catch (err) {
      console.error('[worker] Error disconnecting Prisma:', err);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
