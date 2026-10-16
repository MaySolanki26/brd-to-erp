import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';
import { UnauthorizedError } from '../errors/app-error.js';

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const pairs = header.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key === name) {
      return trimmed.slice(eqIdx + 1).trim();
    }
  }
  return undefined;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookie(req.headers.cookie, 'access_token');
    if (!token) {
      throw new UnauthorizedError('Missing access token');
    }

    const payload: AccessTokenPayload = await verifyAccessToken(token);
    res.locals['user'] = payload;
    next();
  } catch (err) {
    next(err);
  }
}
