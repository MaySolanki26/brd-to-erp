import { z } from 'zod';
import { KNOWLEDGE_STATUSES } from '../constants/knowledge.js';
import {
  LINKED_ITEM_KINDS,
  QUESTION_PRIORITIES,
  QUESTION_REASONS,
} from '../constants/questions.js';
import { uuidSchema } from './project.js';

/**
 * What the model may return for the three understanding prompts. These are deliberately lenient about
 * lengths and counts: the pipeline trims and caps afterwards, so one long sentence never costs a whole call.
 * Everything the model names must be checked against the real items before it is used.
 */

const itemKindSchema = z.enum(LINKED_ITEM_KINDS);
const itemRefSchema = z.object({ kind: itemKindSchema, id: uuidSchema });

// ─── summary.md ─────────────────────────────────────────────────────────────

export const summaryLlmOutputSchema = z.object({
  overview: z.string(),
  modules: z.array(z.object({ moduleId: uuidSchema, name: z.string(), summary: z.string() })),
  keyRequirements: z.array(z.object({ requirementId: uuidSchema, why: z.string() })),
  keyRules: z.array(z.object({ ruleId: uuidSchema, why: z.string() })),
  assumptions: z.array(
    z.object({ itemKind: itemKindSchema, itemId: uuidSchema, statement: z.string() }),
  ),
  staleItems: z.array(z.object({ itemKind: itemKindSchema, itemId: uuidSchema })),
});
export type SummaryLlmOutput = z.infer<typeof summaryLlmOutputSchema>;

// ─── questions.md and the follow-ups in apply-answer.md ─────────────────────

export const generatedQuestionSchema = z.object({
  reason: z.enum(QUESTION_REASONS),
  priority: z.enum(QUESTION_PRIORITIES),
  text: z.string(),
  moduleId: uuidSchema.nullable(),
  linkedItems: z.array(itemRefSchema),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const questionsLlmOutputSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});
export type QuestionsLlmOutput = z.infer<typeof questionsLlmOutputSchema>;

// ─── apply-answer.md ────────────────────────────────────────────────────────

export const applyAnswerLlmOutputSchema = z.object({
  changes: z.array(
    z.object({
      kind: itemKindSchema,
      id: uuidSchema,
      newStatus: z.enum(KNOWLEDGE_STATUSES).nullable(),
      newTitle: z.string().nullable(),
      newDescription: z.string().nullable(),
      reason: z.string(),
    }),
  ),
  conflicts: z.array(z.object({ kind: itemKindSchema, id: uuidSchema, explanation: z.string() })),
  followUpQuestions: z.array(generatedQuestionSchema),
  decisionSummary: z.string(),
});
export type ApplyAnswerLlmOutput = z.infer<typeof applyAnswerLlmOutputSchema>;

// ─── extraction.md ──────────────────────────────────────────────────────────

/**
 * What the model may return for one chunk. Lenient on lengths and counts: the pipeline trims, caps and
 * merges afterwards, so one long title never costs the call. `moduleName` is free text; it is matched
 * to the project's modules by name and never trusted as an id.
 */
const extractedItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  moduleName: z.string().nullable(),
});

export const extractionLlmOutputSchema = z.object({
  modules: z.array(z.object({ name: z.string(), description: z.string() })),
  requirements: z.array(extractedItemSchema),
  rules: z.array(extractedItemSchema),
});
export type ExtractionLlmOutput = z.infer<typeof extractionLlmOutputSchema>;

// ─── report.md ──────────────────────────────────────────────────────────────

/** Lenient: the pipeline trims and caps the narrative, so one long sentence never costs the call. */
export const reportLlmOutputSchema = z.object({
  objectives: z.array(z.string()),
  scope: z.object({ inScope: z.array(z.string()), outOfScope: z.array(z.string()) }),
  roles: z.array(z.object({ name: z.string(), description: z.string() })),
  risks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    }),
  ),
  confidence: z.string(),
});
export type ReportLlmOutput = z.infer<typeof reportLlmOutputSchema>;
