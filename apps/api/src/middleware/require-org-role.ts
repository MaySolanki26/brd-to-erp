import type { Request, Response, NextFunction } from 'express';
import type { OrgRole } from '@brd/shared';
import { ForbiddenError } from '../errors/app-error.js';
import { getAuthUser } from './require-auth.js';

export function requireOrgRole(...roles: OrgRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!roles.includes(getAuthUser(res).orgRole)) {
        throw new ForbiddenError('Insufficient organization role');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
