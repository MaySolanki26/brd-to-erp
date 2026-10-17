import type { Request, Response } from 'express';
import {
  itemParamsSchema,
  revalidateItemSchema,
  type ListKnowledgeQuery,
  type ListModulesQuery,
} from '@brd/shared';
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

function revalidateController(kind: service.RevalidateKind) {
  return async (req: Request, res: Response): Promise<void> => {
    const { itemId } = itemParamsSchema.parse(req.params);
    const input = revalidateItemSchema.parse(req.body);
    await service.revalidateItem(getAuthUser(res), projectIdOf(req), kind, itemId, input);
    res.status(204).end();
  };
}

export const revalidateRequirementController = revalidateController('requirement');
export const revalidateRuleController = revalidateController('rule');
export const revalidateModuleController = revalidateController('module');
