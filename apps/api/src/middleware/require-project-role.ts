import type { Request, Response, NextFunction } from 'express';
import type { ProjectRole } from '@brd/shared';
import { resolveProjectAccess, type ProjectAccess } from '../modules/access/access.service.js';
import { getAuthUser } from './require-auth.js';

const PROJECT_ACCESS_KEY = 'projectAccess';

/** Expects a validated `:id` route param. ORG_ADMIN passes for every project in their org. */
export function requireProjectRole(...roles: ProjectRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params['id'] as string;
      res.locals[PROJECT_ACCESS_KEY] = await resolveProjectAccess(
        getAuthUser(res),
        projectId,
        roles,
      );
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getProjectAccess(res: Response): ProjectAccess {
  return res.locals[PROJECT_ACCESS_KEY] as ProjectAccess;
}
