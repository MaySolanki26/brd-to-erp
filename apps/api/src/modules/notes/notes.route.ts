import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  createNoteSchema,
  listNotesQuerySchema,
  noteParamsSchema,
  projectRolesWith,
  updateNoteSchema,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import {
  createNoteController,
  listNotesController,
  updateNoteController,
} from './notes.controller.js';

export const notesRouter: RouterType = Router({ mergeParams: true });

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
const canAddSource = requireProjectRole(...projectRolesWith(ProjectPermission.ADD_SOURCE));

notesRouter.get('/', validate(listNotesQuerySchema, 'query'), canRead, listNotesController);
notesRouter.post('/', validate(createNoteSchema), canAddSource, createNoteController);
notesRouter.patch(
  '/:noteId',
  validate(noteParamsSchema, 'params'),
  validate(updateNoteSchema),
  canAddSource,
  updateNoteController,
);
