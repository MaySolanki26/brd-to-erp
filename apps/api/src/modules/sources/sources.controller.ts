import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './sources.service.js';

export async function processingStatusController(req: Request, res: Response): Promise<void> {
  res.json({
    status: await service.getProcessingStatus(getAuthUser(res), req.params['id'] as string),
  });
}
