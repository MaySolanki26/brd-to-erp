import { Router, type Router as RouterType } from 'express';
import { ProjectPermission, projectRolesWith, summaryQuerySchema } from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import { getSummaryController, refreshSummaryController } from './summary.controller.js';

export const summaryRouter: RouterType = Router({ mergeParams: true });

summaryRouter.get(
  '/',
  validate(summaryQuerySchema, 'query'),
  requireProjectRole(...projectRolesWith(ProjectPermission.READ)),
  getSummaryController,
);
summaryRouter.post(
  '/refresh',
  requireProjectRole(...projectRolesWith(ProjectPermission.REPROCESS)),
  refreshSummaryController,
);
