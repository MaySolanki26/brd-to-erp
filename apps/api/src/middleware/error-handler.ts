import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = (res.locals['requestId'] as string | undefined) ?? 'unknown';

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = err instanceof AppError ? err.message : 'An unexpected error occurred';

  if (statusCode >= 500) {
    logger.error({ err, requestId }, 'Unhandled server error');
  } else {
    logger.warn({ err, requestId }, 'Client error');
  }

  const body: Record<string, unknown> = {
    error: {
      code,
      message,
      requestId,
    },
  };

  if (env.APP_ENV === 'development' && err.stack) {
    (body['error'] as Record<string, unknown>)['stack'] = err.stack;
  }

  res.status(statusCode).json(body);
}
