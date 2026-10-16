import { Router, type Router as RouterType } from 'express';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userParamsSchema,
} from '@brd/shared';
import { requireAuth } from '../../middleware/require-auth.js';
import { requireCurrentPassword } from '../../middleware/require-current-password.js';
import { requireOrgRole } from '../../middleware/require-org-role.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserController,
  listUsersController,
  resetPasswordController,
  updateUserController,
} from './users.controller.js';

export const usersRouter: RouterType = Router();

const userParams = validate(userParamsSchema, 'params');

usersRouter.use(requireAuth, requireCurrentPassword, requireOrgRole('ORG_ADMIN'));

usersRouter.get('/', listUsersController);
usersRouter.post('/', validate(createUserSchema), createUserController);
usersRouter.patch('/:userId', userParams, validate(updateUserSchema), updateUserController);
usersRouter.post(
  '/:userId/reset-password',
  userParams,
  validate(resetPasswordSchema),
  resetPasswordController,
);
