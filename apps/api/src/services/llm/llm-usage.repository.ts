import type { LlmCallStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export interface NewLlmUsage {
  organizationId: string;
  projectId: string;
  userId?: string | undefined;
  model: string;
  promptName: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  latencyMs: number;
  status: LlmCallStatus;
}

/** Stores token counts and timing only. Prompt and document text are never written. */
export async function recordUsage(data: NewLlmUsage): Promise<void> {
  await prisma.llmUsage.create({
    data: {
      organizationId: data.organizationId,
      projectId: data.projectId,
      userId: data.userId ?? null,
      model: data.model,
      promptName: data.promptName,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.promptTokens + data.completionTokens,
      cachedTokens: data.cachedTokens,
      latencyMs: data.latencyMs,
      status: data.status,
    },
  });
}

export async function tokensUsedSince(
  organizationId: string,
  projectId: string,
  since: Date,
): Promise<number> {
  const result = await prisma.llmUsage.aggregate({
    where: { organizationId, projectId, createdAt: { gte: since } },
    _sum: { totalTokens: true },
  });
  return result._sum.totalTokens ?? 0;
}
