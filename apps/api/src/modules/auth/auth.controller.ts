import type { Request, Response } from 'express';
import type { ChangePasswordInput, LoginInput } from '@brd/shared';
import { UnauthorizedError } from '../../errors/app-error.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  parseCookie,
  setAuthCookies,
} from '../../lib/cookies.js';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as authService from './auth.service.js';

function requestContext(req: Request): authService.RequestContext {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;
  const result = await authService.login(email, password, requestContext(req));
  setAuthCookies(res, result);
  res.json({ user: result.user });
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const token = parseCookie(req.headers.cookie, REFRESH_COOKIE);
  if (!token) {
    throw new UnauthorizedError('Missing refresh token');
  }
  try {
    const result = await authService.refresh(token, requestContext(req));
    setAuthCookies(res, result);
    res.json({ user: result.user });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
}

export function meController(_req: Request, res: Response): void {
  res.json({ user: getAuthUser(res) });
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  await authService.logout(parseCookie(req.headers.cookie, REFRESH_COOKIE));
  clearAuthCookies(res);
  res.json({ success: true });
}

export async function changePasswordController(req: Request, res: Response): Promise<void> {
  const result = await authService.changePassword(
    getAuthUser(res).id,
    req.body as ChangePasswordInput,
    requestContext(req),
  );
  setAuthCookies(res, result);
  res.json({ user: result.user });
}
