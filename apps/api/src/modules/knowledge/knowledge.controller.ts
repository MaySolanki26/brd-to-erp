import type { Request, Response } from 'express';
import type { ListKnowledgeQuery, ListModulesQuery } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './knowledge.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;

export async function listRequirementsController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listRequirements(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListKnowledgeQuery,
    ),
  );
}

export async function listRulesController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listRules(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListKnowledgeQuery,
    ),
  );
}

export async function listModulesController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listModules(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListModulesQuery,
    ),
  );
}

export async function summaryController(req: Request, res: Response): Promise<void> {
  res.json({ summary: await service.getSummary(getAuthUser(res), projectIdOf(req)) });
}

export async function chunkController(req: Request, res: Response): Promise<void> {
  const chunk = await service.getChunk(
    getAuthUser(res),
    projectIdOf(req),
    req.params['chunkId'] as string,
  );
  res.json({ chunk });
}
