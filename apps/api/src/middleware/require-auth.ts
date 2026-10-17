import type { Request, Response, NextFunction } from 'express';
import type { UserDto } from '@brd/shared';
import { ACCESS_COOKIE, parseCookie } from '../lib/cookies.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { getSessionUser, isSessionActive } from '../modules/auth/auth.service.js';

const AUTH_USER_KEY = 'authUser';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = parseCookie(req.headers.cookie, ACCESS_COOKIE);
  if (!token) {
    next(new UnauthorizedError('Missing access token'));
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    // Logout, password change and token-reuse revoke the family, which must end its access tokens too.
    if (!(await isSessionActive(payload.familyId))) {
      throw new UnauthorizedError('Session ended');
    }
    // Role and org come from the database, not the token, so demotions apply immediately.
    res.locals[AUTH_USER_KEY] = await getSessionUser(payload.userId);
    next();
  } catch (err) {
    next(err);
  }
}

export function getAuthUser(res: Response): UserDto {
  const user = res.locals[AUTH_USER_KEY] as UserDto | undefined;
  if (!user) {
    throw new UnauthorizedError('Not authenticated');
  }
  return user;
}
