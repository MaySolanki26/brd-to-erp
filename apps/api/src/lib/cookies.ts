import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';
export const REFRESH_COOKIE_PATH = '/api/auth';

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    if (trimmed.slice(0, eqIdx).trim() === name) {
      return trimmed.slice(eqIdx + 1).trim();
    }
  }
  return undefined;
}

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.APP_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: env.JWT_ACCESS_EXPIRY_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: env.JWT_REFRESH_EXPIRY_SECONDS * 1000,
  });
  // Readable by the web app so it can echo the value in the X-CSRF-Token header.
  res.cookie(CSRF_COOKIE, tokens.csrfToken, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: env.JWT_REFRESH_EXPIRY_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE, { ...baseOptions(), httpOnly: false });
}
