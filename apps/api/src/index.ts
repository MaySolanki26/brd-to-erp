import './config/env.js';

import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { stopQueue } from './services/queue.service.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.APP_ENV },
    `Server listening on http://localhost:${env.PORT}`,
  );
});

const SHUTDOWN_TIMEOUT = 10_000;

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully...');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await stopQueue();
  } catch (err) {
    logger.error({ err }, 'Error stopping job queue');
  }

  try {
    await disconnectPrisma();
    logger.info('Prisma disconnected');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting Prisma');
  }

  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
