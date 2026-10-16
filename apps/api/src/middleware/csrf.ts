import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { CsrfError } from '../errors/app-error.js';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
  parseCookie,
} from '../lib/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// No session exists yet at login; refresh is protected by the Origin check and its path-scoped cookie.
const TOKEN_EXEMPT_PATHS = new Set(['/auth/login', '/auth/refresh']);

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function originAllowed(origin: string | undefined): boolean {
  return origin === undefined || env.CORS_ORIGINS.includes(origin);
}

/**
 * CSRF protection for cookie-authenticated mutations (mount under /api):
 * 1. a present Origin header must be an allowed origin;
 * 2. the X-CSRF-Token header must equal the csrf_token cookie (double submit).
 * Requests carrying no auth cookies have no ambient credentials to abuse and pass through.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieHeader = req.headers.cookie;
  const hasSessionCookie =
    parseCookie(cookieHeader, ACCESS_COOKIE) !== undefined ||
    parseCookie(cookieHeader, REFRESH_COOKIE) !== undefined;
  if (!hasSessionCookie) {
    next();
    return;
  }

  if (!originAllowed(req.get('origin'))) {
    next(new CsrfError('Origin not allowed'));
    return;
  }

  if (TOKEN_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const cookieToken = parseCookie(cookieHeader, CSRF_COOKIE);
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    next(new CsrfError());
    return;
  }
  next();
}
