import type { Request, Response } from 'express';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import { getProjectAccess } from '../../middleware/require-project-role.js';
import { toProjectDto } from './projects.service.js';
import * as service from './projects.service.js';

export async function listProjectsController(req: Request, res: Response): Promise<void> {
  res.json(await service.listProjects(getAuthUser(res), req.query as unknown as ListProjectsQuery));
}

export async function createProjectController(req: Request, res: Response): Promise<void> {
  const project = await service.createProject(getAuthUser(res), req.body as CreateProjectInput);
  res.status(201).json({ project });
}

export function getProjectController(_req: Request, res: Response): void {
  const { project, role } = getProjectAccess(res);
  res.json({ project: toProjectDto(project, role) });
}

export async function updateProjectController(req: Request, res: Response): Promise<void> {
  const project = await service.updateProject(
    getAuthUser(res),
    getProjectAccess(res),
    req.body as UpdateProjectInput,
  );
  res.json({ project });
}

export async function archiveProjectController(_req: Request, res: Response): Promise<void> {
  const project = await service.archiveProject(getAuthUser(res), getProjectAccess(res));
  res.json({ project });
}
