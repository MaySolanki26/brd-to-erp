import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  addMemberSchema,
  memberParamsSchema,
  projectRolesWith,
  updateMemberSchema,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import {
  addMemberController,
  listMembersController,
  removeMemberController,
  updateMemberController,
} from './members.controller.js';

export const membersRouter: RouterType = Router({ mergeParams: true });

const manageMembers = requireProjectRole(...projectRolesWith(ProjectPermission.MANAGE_MEMBERS));
const memberParams = validate(memberParamsSchema, 'params');

membersRouter.get('/', manageMembers, listMembersController);
membersRouter.post('/', manageMembers, validate(addMemberSchema), addMemberController);
membersRouter.patch(
  '/:userId',
  memberParams,
  manageMembers,
  validate(updateMemberSchema),
  updateMemberController,
);
membersRouter.delete('/:userId', memberParams, manageMembers, removeMemberController);
