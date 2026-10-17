import type { Request, Response } from 'express';
import {
  approveReportSchema,
  approveWithConditionsSchema,
  conditionParamsSchema,
  rejectReportSchema,
  reportVersionParamsSchema,
  updateConditionSchema,
} from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import { reportService } from './report.runtime.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;
const versionOf = (req: Request): number => reportVersionParamsSchema.parse(req.params).version;

export async function readinessController(req: Request, res: Response): Promise<void> {
  res.json(await reportService.readiness(getAuthUser(res), projectIdOf(req)));
}

export async function generateController(req: Request, res: Response): Promise<void> {
  res.status(202).json(await reportService.generate(getAuthUser(res), projectIdOf(req)));
}

export async function listVersionsController(req: Request, res: Response): Promise<void> {
  res.json(await reportService.listVersions(getAuthUser(res), projectIdOf(req)));
}

export async function getVersionController(req: Request, res: Response): Promise<void> {
  res.json(await reportService.getVersion(getAuthUser(res), projectIdOf(req), versionOf(req)));
}

export async function submitController(req: Request, res: Response): Promise<void> {
  await reportService.submit(getAuthUser(res), projectIdOf(req), versionOf(req));
  res.status(204).end();
}

export async function approveController(req: Request, res: Response): Promise<void> {
  const input = approveReportSchema.parse(req.body);
  await reportService.approve(getAuthUser(res), projectIdOf(req), versionOf(req), input);
  res.status(204).end();
}

export async function rejectController(req: Request, res: Response): Promise<void> {
  const input = rejectReportSchema.parse(req.body);
  await reportService.reject(getAuthUser(res), projectIdOf(req), versionOf(req), input);
  res.status(204).end();
}

export async function approveWithConditionsController(req: Request, res: Response): Promise<void> {
  const input = approveWithConditionsSchema.parse(req.body);
  await reportService.approveWithConditions(
    getAuthUser(res),
    projectIdOf(req),
    versionOf(req),
    input,
  );
  res.status(204).end();
}

export async function updateConditionController(req: Request, res: Response): Promise<void> {
  const { conditionId } = conditionParamsSchema.parse(req.params);
  const input = updateConditionSchema.parse(req.body);
  await reportService.updateCondition(
    getAuthUser(res),
    projectIdOf(req),
    versionOf(req),
    conditionId,
    input,
  );
  res.status(204).end();
}
