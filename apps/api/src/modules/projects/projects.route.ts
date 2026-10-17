import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  chunkParamsSchema,
  createProjectSchema,
  itemParamsSchema,
  listKnowledgeQuerySchema,
  listModulesQuerySchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  projectRolesWith,
  revalidateItemSchema,
  updateProjectSchema,
} from '@brd/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireCurrentPassword } from '../../middleware/require-current-password.js';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import { decisionsRouter } from '../decisions/decisions.route.js';
import { documentsRouter } from '../documents/documents.route.js';
import {
  chunkController,
  listModulesController,
  listRequirementsController,
  listRulesController,
  revalidateModuleController,
  revalidateRequirementController,
  revalidateRuleController,
  summaryController,
} from '../knowledge/knowledge.controller.js';
import { membersRouter } from '../members/members.route.js';
import { notesRouter } from '../notes/notes.route.js';
import { questionsRouter } from '../questions/questions.route.js';
import { reportRouter } from '../report/report.route.js';
import { processingStatusController } from '../sources/sources.controller.js';
import { summaryRouter } from '../summary/summary.route.js';
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
projectsRouter.use('/:id/members', idParams, membersRouter);
projectsRouter.use('/:id/documents', idParams, documentsRouter);
projectsRouter.use('/:id/notes', idParams, notesRouter);
projectsRouter.use('/:id/questions', idParams, questionsRouter);
projectsRouter.use('/:id/decisions', idParams, decisionsRouter);
projectsRouter.use('/:id/summary', idParams, summaryRouter);
projectsRouter.use('/:id/report', idParams, reportRouter);
projectsRouter.get(
  '/:id/processing-status',
  idParams,
  requireProjectRole(...projectRolesWith(ProjectPermission.READ)),
  processingStatusController,
);

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
projectsRouter.get(
  '/:id/requirements',
  idParams,
  validate(listKnowledgeQuerySchema, 'query'),
  canRead,
  listRequirementsController,
);
projectsRouter.get(
  '/:id/rules',
  idParams,
  validate(listKnowledgeQuerySchema, 'query'),
  canRead,
  listRulesController,
);
projectsRouter.get(
  '/:id/modules',
  idParams,
  validate(listModulesQuerySchema, 'query'),
  canRead,
  listModulesController,
);
const canDecideItems = requireProjectRole(...projectRolesWith(ProjectPermission.ANSWER_QUESTION));
for (const [path, controller] of [
  ['requirements', revalidateRequirementController],
  ['rules', revalidateRuleController],
  ['modules', revalidateModuleController],
] as const) {
  projectsRouter.post(
    `/:id/${path}/:itemId/revalidate`,
    validate(itemParamsSchema, 'params'),
    canDecideItems,
    validate(revalidateItemSchema),
    controller,
  );
}
projectsRouter.get('/:id/knowledge-summary', idParams, canRead, summaryController);
projectsRouter.get(
  '/:id/chunks/:chunkId',
  validate(chunkParamsSchema, 'params'),
  canRead,
  chunkController,
);
