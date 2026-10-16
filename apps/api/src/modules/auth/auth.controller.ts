import type { Request, Response, NextFunction } from 'express';
import type { LoginInput } from '@brd/shared';
import type { AccessTokenPayload } from '../../lib/jwt.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../errors/app-error.js';
import * as authService from './auth.service.js';

function parseCookie(header: string | undefined, name: string): string | undefined {
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

const cookieBase: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
} = {
  httpOnly: true,
  secure: env.APP_ENV !== 'development',
  sameSite: 'lax',
  path: '/',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    ...cookieBase,
    maxAge: env.JWT_ACCESS_EXPIRY_SECONDS * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: env.JWT_REFRESH_EXPIRY_SECONDS * 1000,
    path: '/auth/refresh',
  });
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;
    const result = await authService.login(email, password);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookie(req.headers.cookie, 'refresh_token');
    if (!token) {
      throw new UnauthorizedError('Missing refresh token');
    }

    const result = await authService.refresh(token);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function meController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = res.locals['user'] as AccessTokenPayload;
    const user = await authService.getMe(userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function logoutController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.clearCookie('access_token', { ...cookieBase });
    res.clearCookie('refresh_token', { ...cookieBase, path: '/auth/refresh' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
