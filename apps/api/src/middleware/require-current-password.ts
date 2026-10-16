import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/app-error.js';
import { getAuthUser } from './require-auth.js';

/** Blocks users who are still on an admin-issued temporary password until they change it. */
export function requireCurrentPassword(_req: Request, res: Response, next: NextFunction): void {
  try {
    if (getAuthUser(res).mustChangePassword) {
      throw new ForbiddenError('Password change required');
    }
    next();
  } catch (err) {
    next(err);
  }
}
