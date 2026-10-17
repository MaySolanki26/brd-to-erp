import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  approveReportSchema,
  approveWithConditionsSchema,
  conditionParamsSchema,
  projectRolesWith,
  rejectReportSchema,
  reportVersionParamsSchema,
  updateConditionSchema,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import {
  approveController,
  approveWithConditionsController,
  generateController,
  getVersionController,
  listVersionsController,
  readinessController,
  rejectController,
  submitController,
  updateConditionController,
} from './report.controller.js';

export const reportRouter: RouterType = Router({ mergeParams: true });

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
const canSubmit = requireProjectRole(...projectRolesWith(ProjectPermission.SUBMIT_REPORT));
const canDecide = requireProjectRole(...projectRolesWith(ProjectPermission.APPROVE));
const versionParams = validate(reportVersionParamsSchema, 'params');

reportRouter.get('/readiness', canRead, readinessController);
reportRouter.get('/versions', canRead, listVersionsController);
reportRouter.post('/generate', canSubmit, generateController);
reportRouter.get('/versions/:version', versionParams, canRead, getVersionController);
reportRouter.post('/versions/:version/submit', versionParams, canSubmit, submitController);
reportRouter.post(
  '/versions/:version/approve',
  versionParams,
  canDecide,
  validate(approveReportSchema),
  approveController,
);
reportRouter.post(
  '/versions/:version/reject',
  versionParams,
  canDecide,
  validate(rejectReportSchema),
  rejectController,
);
reportRouter.post(
  '/versions/:version/approve-with-conditions',
  versionParams,
  canDecide,
  validate(approveWithConditionsSchema),
  approveWithConditionsController,
);
reportRouter.patch(
  '/versions/:version/conditions/:conditionId',
  validate(conditionParamsSchema, 'params'),
  canDecide,
  validate(updateConditionSchema),
  updateConditionController,
);
