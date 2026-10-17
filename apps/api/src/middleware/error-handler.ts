import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

/** Express body parsers (e.g. an oversized upload) set a 4xx status on plain errors. */
function bodyParserStatus(err: Error): number | undefined {
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

function codeForStatus(status: number | undefined): string {
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  return status === undefined ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
}

function messageForStatus(status: number | undefined): string {
  if (status === 413) return 'The request is too large';
  return status === undefined
    ? 'An unexpected error occurred'
    : 'The request could not be processed';
}

/** A unique-constraint race that slipped past an existence check is a conflict, not a server fault. */
function isUniqueViolation(err: Error): boolean {
  return (err as { code?: unknown }).code === 'P2002';
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = (res.locals['requestId'] as string | undefined) ?? 'unknown';

  const conflict = !(err instanceof AppError) && isUniqueViolation(err);
  const parserStatus = bodyParserStatus(err);
  const statusCode =
    err instanceof AppError ? err.statusCode : conflict ? 409 : (parserStatus ?? 500);
  const code =
    err instanceof AppError ? err.code : conflict ? 'CONFLICT' : codeForStatus(parserStatus);
  const message =
    err instanceof AppError
      ? err.message
      : conflict
        ? 'Already exists'
        : messageForStatus(parserStatus);

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
