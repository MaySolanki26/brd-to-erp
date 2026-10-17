import { Router, type Router as RouterType } from 'express';
import {
  ProjectPermission,
  answerQuestionSchema,
  dismissQuestionSchema,
  listQuestionsQuerySchema,
  projectRolesWith,
  questionParamsSchema,
} from '@brd/shared';
import { requireProjectRole } from '../../middleware/require-project-role.js';
import { validate } from '../../middleware/validate.js';
import {
  answerQuestionController,
  dismissQuestionController,
  listQuestionsController,
  questionCountsController,
} from './questions.controller.js';

export const questionsRouter: RouterType = Router({ mergeParams: true });

const canRead = requireProjectRole(...projectRolesWith(ProjectPermission.READ));
const canAnswer = requireProjectRole(...projectRolesWith(ProjectPermission.ANSWER_QUESTION));
const questionParams = validate(questionParamsSchema, 'params');

questionsRouter.get(
  '/',
  validate(listQuestionsQuerySchema, 'query'),
  canRead,
  listQuestionsController,
);
questionsRouter.get('/counts', canRead, questionCountsController);
questionsRouter.post(
  '/:qid/answer',
  questionParams,
  validate(answerQuestionSchema),
  canAnswer,
  answerQuestionController,
);
questionsRouter.post(
  '/:qid/dismiss',
  questionParams,
  validate(dismissQuestionSchema),
  canAnswer,
  dismissQuestionController,
);
