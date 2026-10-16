import { Router, type Router as RouterType } from 'express';
import { changePasswordSchema, loginSchema } from '@brd/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { createLoginRateLimit } from '../../middleware/login-rate-limit.js';
import {
  loginController,
  refreshController,
  meController,
  logoutController,
  changePasswordController,
} from './auth.controller.js';

export function createAuthRouter(options: { rateLimit: boolean }): RouterType {
  const router: RouterType = Router();

  const loginMiddleware = [
    ...(options.rateLimit ? [createLoginRateLimit()] : []),
    validate(loginSchema),
    loginController,
  ];

  router.post('/login', ...loginMiddleware);
  router.post('/refresh', refreshController);
  router.get('/me', requireAuth, meController);
  router.post('/logout', logoutController);
  router.post(
    '/change-password',
    requireAuth,
    validate(changePasswordSchema),
    changePasswordController,
  );

  return router;
}
