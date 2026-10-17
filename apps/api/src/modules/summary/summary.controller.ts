import type { Request, Response } from 'express';
import { summaryQuerySchema } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './summary.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;

export async function getSummaryController(req: Request, res: Response): Promise<void> {
  const query = summaryQuerySchema.parse(req.query);
  res.json(await service.getSummary(getAuthUser(res), projectIdOf(req), query));
}

export async function refreshSummaryController(req: Request, res: Response): Promise<void> {
  res.status(202).json(await service.requestRefresh(getAuthUser(res), projectIdOf(req)));
}
