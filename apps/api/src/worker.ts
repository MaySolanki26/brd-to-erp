import './config/env.js';

import { createBoss, ensureQueues } from './lib/boss.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { registerAllHandlers } from './jobs/index.js';

async function main(): Promise<void> {
  const boss = createBoss();

  await boss.start();
  await ensureQueues(boss);
  logger.info('Worker: pg-boss started');

  await registerAllHandlers(boss);
  logger.info('Worker ready, waiting for jobs');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Worker shutting down gracefully');

    try {
      await boss.stop({ graceful: true, timeout: 30_000 });
      logger.info('Worker: pg-boss stopped');
    } catch (err) {
      logger.error({ err }, 'Worker: error stopping pg-boss');
    }

    try {
      await disconnectPrisma();
      logger.info('Worker: Prisma disconnected');
    } catch (err) {
      logger.error({ err }, 'Worker: error disconnecting Prisma');
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Worker: fatal error');
  process.exit(1);
});
