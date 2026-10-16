import { Router, type Router as RouterType } from 'express';
import { loginSchema } from '@brd/shared';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginController, refreshController, meController, logoutController } from './auth.controller.js';

export const authRouter: RouterType = Router();

authRouter.post('/login', validate(loginSchema), loginController);
authRouter.post('/refresh', refreshController);
authRouter.get('/me', authenticate, meController);
authRouter.post('/logout', logoutController);
