import { z } from 'zod';
import {
  CONDITION_STATUSES,
  MAX_COMMENT_CHARS,
  MAX_CONDITIONS,
  MAX_CONDITION_CHARS,
  MAX_REJECTION_CHARS,
  RISK_SEVERITIES,
} from '../constants/report.js';
import { KNOWLEDGE_STATUSES } from '../constants/knowledge.js';
import { QUESTION_PRIORITIES, QUESTION_REASONS } from '../constants/questions.js';
import { uuidSchema } from './project.js';

export const reportVersionParamsSchema = z.object({
  id: uuidSchema,
  version: z.coerce.number().int().min(1),
});
export type ReportVersionParams = z.infer<typeof reportVersionParamsSchema>;

export const conditionParamsSchema = reportVersionParamsSchema.extend({ conditionId: uuidSchema });
export type ConditionParams = z.infer<typeof conditionParamsSchema>;

const commentSchema = z.string().trim().max(MAX_COMMENT_CHARS);

export const approveReportSchema = z.object({ comment: commentSchema.optional() }).strict();
export type ApproveReportInput = z.infer<typeof approveReportSchema>;

export const rejectReportSchema = z
  .object({
    reason: z.string().trim().min(1, 'Say why the report is rejected').max(MAX_REJECTION_CHARS),
  })
  .strict();
export type RejectReportInput = z.infer<typeof rejectReportSchema>;

export const approveWithConditionsSchema = z
  .object({
    comment: commentSchema.optional(),
    conditions: z
      .array(
        z.object({
          text: z.string().trim().min(1, 'A condition needs text').max(MAX_CONDITION_CHARS),
        }),
      )
      .min(1, 'Add at least one condition')
      .max(MAX_CONDITIONS),
  })
  .strict();
export type ApproveWithConditionsInput = z.infer<typeof approveWithConditionsSchema>;

export const updateConditionSchema = z
  .object({
    status: z.enum(CONDITION_STATUSES).optional(),
    text: z.string().trim().min(1).max(MAX_CONDITION_CHARS).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateConditionInput = z.infer<typeof updateConditionSchema>;

// ─── What a report holds ────────────────────────────────────────────────────

const knowledgeStatusSchema = z.enum(KNOWLEDGE_STATUSES);

const reportItemSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  description: z.string().nullable(),
  status: knowledgeStatusSchema,
  moduleName: z.string().nullable(),
});

/** The narrative a model writes; everything else in a report is assembled from the database. */
export const reportNarrativeSchema = z.object({
  objectives: z.array(z.string()),
  scope: z.object({ inScope: z.array(z.string()), outOfScope: z.array(z.string()) }),
  roles: z.array(z.object({ name: z.string(), description: z.string() })),
  risks: z.array(
    z.object({ title: z.string(), description: z.string(), severity: z.enum(RISK_SEVERITIES) }),
  ),
  confidence: z.string(),
});
export type ReportNarrative = z.infer<typeof reportNarrativeSchema>;

export const reportContentSchema = z.object({
  projectName: z.string(),
  summaryVersion: z.number().int(),
  narrative: reportNarrativeSchema,
  counts: z.object({
    requirements: z.record(z.string(), z.number()),
    rules: z.record(z.string(), z.number()),
    modules: z.record(z.string(), z.number()),
  }),
  modules: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      code: z.string(),
      description: z.string().nullable(),
      status: knowledgeStatusSchema,
    }),
  ),
  requirements: z.array(reportItemSchema),
  rules: z.array(reportItemSchema),
  assumptions: z.array(
    z.object({ kind: z.string(), id: uuidSchema, title: z.string(), statement: z.string() }),
  ),
  openQuestions: z.object({
    total: z.number().int(),
    items: z.array(
      z.object({
        id: uuidSchema,
        priority: z.enum(QUESTION_PRIORITIES),
        reason: z.enum(QUESTION_REASONS),
        text: z.string(),
        moduleName: z.string().nullable(),
      }),
    ),
  }),
});
export type ReportContent = z.infer<typeof reportContentSchema>;
