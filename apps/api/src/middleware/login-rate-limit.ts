import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import { TooManyRequestsError } from '../errors/app-error.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function emailOf(body: unknown): string {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Throttles login attempts per IP + email so one address cannot be hammered from one client. */
export function createLoginRateLimit(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${emailOf(req.body)}`,
    handler: (_req, _res, next) => next(new TooManyRequestsError('Too many login attempts')),
  });
}
