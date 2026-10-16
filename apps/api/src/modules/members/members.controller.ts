import type { Request, Response } from 'express';
import type { AddMemberInput, UpdateMemberInput } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './members.service.js';

function projectIdOf(req: Request): string {
  return req.params['id'] as string;
}

export async function listMembersController(req: Request, res: Response): Promise<void> {
  res.json({ members: await service.listMembers(getAuthUser(res), projectIdOf(req)) });
}

export async function listCandidatesController(req: Request, res: Response): Promise<void> {
  res.json({ candidates: await service.listCandidates(getAuthUser(res), projectIdOf(req)) });
}

export async function addMemberController(req: Request, res: Response): Promise<void> {
  const member = await service.addMember(
    getAuthUser(res),
    projectIdOf(req),
    req.body as AddMemberInput,
  );
  res.status(201).json({ member });
}

export async function updateMemberController(req: Request, res: Response): Promise<void> {
  const member = await service.updateMemberRole(
    getAuthUser(res),
    projectIdOf(req),
    req.params['userId'] as string,
    req.body as UpdateMemberInput,
  );
  res.json({ member });
}

export async function removeMemberController(req: Request, res: Response): Promise<void> {
  await service.removeMember(getAuthUser(res), projectIdOf(req), req.params['userId'] as string);
  res.status(204).end();
}
