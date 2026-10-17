import { Router, type Router as RouterType } from 'express';
import { ProjectPermission, listDecisionsQuerySchema, projectRolesWith } from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import { listDecisionsController } from './decisions.controller.js';

export const decisionsRouter: RouterType = Router({ mergeParams: true });

decisionsRouter.get(
  '/',
  validate(listDecisionsQuerySchema, 'query'),
  requireProjectRole(...projectRolesWith(ProjectPermission.READ)),
  listDecisionsController,
);
