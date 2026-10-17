import type { Request, Response } from 'express';
import { listDecisionsQuerySchema } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './decisions.service.js';

export async function listDecisionsController(req: Request, res: Response): Promise<void> {
  const query = listDecisionsQuerySchema.parse(req.query);
  res.json(await service.listDecisions(getAuthUser(res), req.params['id'] as string, query));
}
