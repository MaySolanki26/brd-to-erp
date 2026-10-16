import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  projectRolesWith,
  updateProjectSchema,
} from '@brd/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireCurrentPassword } from '../../middleware/require-current-password.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import { membersRouter } from '../members/members.route.js';
import {
  archiveProjectController,
  createProjectController,
  getProjectController,
  listProjectsController,
  updateProjectController,
} from './projects.controller.js';

export const projectsRouter: RouterType = Router();

const idParams = validate(projectIdParamsSchema, 'params');

projectsRouter.use(requireAuth, requireCurrentPassword);

projectsRouter.get('/', validate(listProjectsQuerySchema, 'query'), listProjectsController);
projectsRouter.post('/', validate(createProjectSchema), createProjectController);
projectsRouter.get(
  '/:id',
  idParams,
  requireProjectRole(...projectRolesWith(ProjectPermission.READ)),
  getProjectController,
);
projectsRouter.patch(
  '/:id',
  idParams,
  requireProjectRole(...projectRolesWith(ProjectPermission.UPDATE_PROJECT)),
  validate(updateProjectSchema),
  updateProjectController,
);
projectsRouter.post(
  '/:id/archive',
  idParams,
  requireProjectRole(...projectRolesWith(ProjectPermission.ARCHIVE_PROJECT)),
  archiveProjectController,
);
projectsRouter.use('/:id/members', membersRouter);
