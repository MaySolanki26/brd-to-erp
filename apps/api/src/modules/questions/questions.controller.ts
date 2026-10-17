import type { Request, Response } from 'express';
import { answerQuestionSchema, dismissQuestionSchema, listQuestionsQuerySchema } from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './questions.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;
const questionIdOf = (req: Request): string => req.params['qid'] as string;

export async function listQuestionsController(req: Request, res: Response): Promise<void> {
  const query = listQuestionsQuerySchema.parse(req.query);
  res.json(await service.listQuestions(getAuthUser(res), projectIdOf(req), query));
}

export async function questionCountsController(req: Request, res: Response): Promise<void> {
  res.json({ counts: await service.getCounts(getAuthUser(res), projectIdOf(req)) });
}

export async function answerQuestionController(req: Request, res: Response): Promise<void> {
  const input = answerQuestionSchema.parse(req.body);
  const question = await service.answerQuestion(
    getAuthUser(res),
    projectIdOf(req),
    questionIdOf(req),
    input,
  );
  res.status(201).json({ question });
}

export async function dismissQuestionController(req: Request, res: Response): Promise<void> {
  const input = dismissQuestionSchema.parse(req.body);
  const question = await service.dismissQuestion(
    getAuthUser(res),
    projectIdOf(req),
    questionIdOf(req),
    input,
  );
  res.json({ question });
}
