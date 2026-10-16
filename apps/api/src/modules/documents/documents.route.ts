import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  confirmUploadSchema,
  documentDetailQuerySchema,
  documentParamsSchema,
  documentVersionParamsSchema,
  listDocumentsQuerySchema,
  projectRolesWith,
  uploadUrlRequestSchema,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import {
  confirmUploadController,
  createUploadUrlController,
  downloadVersionController,
  getDocumentController,
  listDocumentsController,
  reprocessDocumentController,
} from './documents.controller.js';

export const documentsRouter: RouterType = Router({ mergeParams: true });

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
const canAddSource = requireProjectRole(...projectRolesWith(ProjectPermission.ADD_SOURCE));
const canReprocess = requireProjectRole(...projectRolesWith(ProjectPermission.REPROCESS));

documentsRouter.get(
  '/',
  validate(listDocumentsQuerySchema, 'query'),
  canRead,
  listDocumentsController,
);
documentsRouter.post(
  '/upload-url',
  validate(uploadUrlRequestSchema),
  canAddSource,
  createUploadUrlController,
);
documentsRouter.post(
  '/confirm',
  validate(confirmUploadSchema),
  canAddSource,
  confirmUploadController,
);
documentsRouter.get(
  '/:docId',
  validate(documentParamsSchema, 'params'),
  validate(documentDetailQuerySchema, 'query'),
  canRead,
  getDocumentController,
);
documentsRouter.get(
  '/:docId/versions/:versionId/download',
  validate(documentVersionParamsSchema, 'params'),
  canRead,
  downloadVersionController,
);
documentsRouter.post(
  '/:docId/reprocess',
  validate(documentParamsSchema, 'params'),
  canReprocess,
  reprocessDocumentController,
);
