import { z } from 'zod';
import { KNOWLEDGE_STATUSES } from '../constants/knowledge.js';
import {
  MAX_ANSWER_CHARS,
  LINKED_ITEM_KINDS,
  MAX_DISMISS_REASON_CHARS,
  QUESTION_PRIORITIES,
  QUESTION_REASONS,
  QUESTION_STATUSES,
} from '../constants/questions.js';
import { uuidSchema } from './project.js';

export const questionStatusSchema = z.enum(QUESTION_STATUSES);
export const questionReasonSchema = z.enum(QUESTION_REASONS);
export const questionPrioritySchema = z.enum(QUESTION_PRIORITIES);

export const questionParamsSchema = z.object({ id: uuidSchema, qid: uuidSchema });
export type QuestionParams = z.infer<typeof questionParamsSchema>;

export const listQuestionsQuerySchema = z.object({
  status: questionStatusSchema.optional(),
  reason: questionReasonSchema.optional(),
  priority: questionPrioritySchema.optional(),
  moduleId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;

/** `version` is the question version the person was looking at; a mismatch is a 409. */
export const answerQuestionSchema = z
  .object({
    answer: z
      .string()
      .trim()
      .min(1, 'Write an answer first')
      .max(MAX_ANSWER_CHARS, `Answers are limited to ${String(MAX_ANSWER_CHARS)} characters`),
    version: z.number().int().min(1),
  })
  .strict();
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;

export const dismissQuestionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Say why this question is being dismissed')
      .max(
        MAX_DISMISS_REASON_CHARS,
        `Reasons are limited to ${String(MAX_DISMISS_REASON_CHARS)} characters`,
      ),
    version: z.number().int().min(1),
  })
  .strict();
export type DismissQuestionInput = z.infer<typeof dismissQuestionSchema>;

export const listDecisionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;

export const summaryQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

// What the understanding jobs store inside a Decision. Read leniently: an entry that does not
// match is dropped instead of failing the whole timeline.
const itemStateRecordSchema = z.object({
  status: z.enum(KNOWLEDGE_STATUSES),
  title: z.string(),
  description: z.string().nullable(),
});

export const decisionChangeRecordSchema = z.object({
  kind: z.enum(LINKED_ITEM_KINDS),
  id: uuidSchema,
  before: itemStateRecordSchema,
  after: itemStateRecordSchema,
  reason: z.string().nullable().optional(),
});
export type DecisionChangeRecord = z.infer<typeof decisionChangeRecordSchema>;

export const decisionConflictRecordSchema = z.object({
  kind: z.enum(LINKED_ITEM_KINDS),
  id: uuidSchema,
  title: z.string().nullable().optional(),
  explanation: z.string(),
});
export type DecisionConflictRecord = z.infer<typeof decisionConflictRecordSchema>;
