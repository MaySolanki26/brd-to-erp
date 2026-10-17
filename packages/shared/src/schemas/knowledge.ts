import { z } from 'zod';
import { KNOWLEDGE_STATUSES } from '../constants/knowledge.js';
import { uuidSchema } from './project.js';

export const knowledgeStatusSchema = z.enum(KNOWLEDGE_STATUSES);

export const chunkParamsSchema = z.object({ id: uuidSchema, chunkId: uuidSchema });
export type ChunkParams = z.infer<typeof chunkParamsSchema>;

const pagingShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: knowledgeStatusSchema.optional(),
  /** A document or a context note; items extracted from any version of it match. */
  sourceId: uuidSchema.optional(),
  search: z.string().trim().max(100).optional(),
  /** Only items whose source chunk could not be read cleanly (their own, or one they were merged from). */
  needsReview: z
    .enum(['true', 'false'])
    .transform((value) => (value === 'true' ? true : undefined))
    .optional(),
};

export const listModulesQuerySchema = z.object(pagingShape);
export type ListModulesQuery = z.infer<typeof listModulesQuerySchema>;

export const listKnowledgeQuerySchema = z.object({
  ...pagingShape,
  moduleId: uuidSchema.optional(),
});
export type ListKnowledgeQuery = z.infer<typeof listKnowledgeQuerySchema>;
