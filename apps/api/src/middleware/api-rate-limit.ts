import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ACCESS_COOKIE, parseCookie } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/jwt.js';

const WINDOW_MS = 15 * 60 * 1000;
/** Callers we cannot identify are counted per IP, so one address cannot flood the API. */
export const ANONYMOUS_LIMIT = 100;
/**
 * Signed-in people are counted per user, with room for the polling the screens do while a source
 * is processing (one request every few seconds) across a few open tabs.
 */
export const USER_LIMIT = 1500;

/**
 * Every signed-in person refreshes their session about every 15 minutes, and that request cannot be
 * tied to a user without a database lookup. Counting it with other anonymous traffic would let one
 * office behind a single IP lock itself out, so refreshes get their own, larger allowance per IP.
 * A guessed refresh token is worthless (they are long and random), so this is not a login throttle.
 */
export const REFRESH_LIMIT = 1000;
const REFRESH_PATH = '/api/auth/refresh';

const CALLER_KEY = 'rateLimitUserId';

/**
 * Finds out who is calling from the signature of the access token alone (no database). A forged or
 * expired token proves nothing, so that caller is counted as anonymous.
 */
async function identifyCaller(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = parseCookie(req.headers.cookie, ACCESS_COOKIE);
  if (token) {
    try {
      res.locals[CALLER_KEY] = (await verifyAccessToken(token)).userId;
    } catch {
      // Not a valid token: counted by IP like any anonymous caller.
    }
  }
  next();
}

export interface ApiRateLimitOptions {
  anonymousLimit?: number;
  userLimit?: number;
  refreshLimit?: number;
}

/** The limit for every /api request: per user when signed in, per IP otherwise. */
export function createApiRateLimit(options: ApiRateLimitOptions = {}): RequestHandler[] {
  const anonymousLimit = options.anonymousLimit ?? ANONYMOUS_LIMIT;
  const userLimit = options.userLimit ?? USER_LIMIT;
  const refreshLimit = options.refreshLimit ?? REFRESH_LIMIT;
  const isRefresh = (req: Request): boolean => req.originalUrl.split('?')[0] === REFRESH_PATH;
  const userOf = (res: Response): string | undefined =>
    res.locals[CALLER_KEY] as string | undefined;

  const limiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: (req, res) => {
      if (userOf(res)) return userLimit;
      return isRefresh(req) ? refreshLimit : anonymousLimit;
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req, res) => {
      const user = userOf(res);
      if (user) return `user:${user}`;
      const ip = ipKeyGenerator(req.ip ?? '');
      return isRefresh(req) ? `refresh:${ip}` : `ip:${ip}`;
    },
    message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  });
  return [identifyCaller, limiter];
}
