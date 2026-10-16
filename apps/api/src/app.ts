import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/request-id.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './modules/health/health.route.js';
import { storageRouter } from './modules/storage/storage.route.js';
import { csrfProtection } from './middleware/csrf.js';
import { createAuthRouter } from './modules/auth/auth.route.js';
import { projectsRouter } from './modules/projects/projects.route.js';

export interface AppOptions {
  /** Disable rate limiting (tests only). */
  rateLimit?: boolean;
}

export function createApp(options: AppOptions = {}): express.Express {
  const rateLimitEnabled = options.rateLimit ?? true;
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
      credentials: true,
    }),
  );

  // Rate limiting
  if (rateLimitEnabled) {
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
      }),
    );
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request ID (before pino-http so logs include it)
  app.use(requestId);

  // Request logging
  app.use(
    pinoHttp({
      logger,
      customProps: (_req, res) => ({
        requestId: (res as express.Response).locals['requestId'],
      }),
    }),
  );

  // Routes
  app.use('/health', healthRouter);
  app.use('/api', csrfProtection);
  app.use('/api/auth', createAuthRouter({ rateLimit: rateLimitEnabled }));
  app.use('/api/projects', projectsRouter);
  app.use('/storage', storageRouter);

  // Fallback handlers
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
