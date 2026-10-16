import type { Request, Response } from 'express';
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './users.service.js';

function userIdOf(req: Request): string {
  return req.params['userId'] as string;
}

export async function listUsersController(_req: Request, res: Response): Promise<void> {
  res.json({ users: await service.listUsers(getAuthUser(res)) });
}

export async function createUserController(req: Request, res: Response): Promise<void> {
  const user = await service.createUser(getAuthUser(res), req.body as CreateUserInput);
  res.status(201).json({ user });
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
  const user = await service.updateUser(
    getAuthUser(res),
    userIdOf(req),
    req.body as UpdateUserInput,
  );
  res.json({ user });
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  const user = await service.resetPassword(
    getAuthUser(res),
    userIdOf(req),
    req.body as ResetPasswordInput,
  );
  res.json({ user });
}
