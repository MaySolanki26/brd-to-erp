import type { ProcessingStatusDto, SourceStatus, UserDto } from '@brd/shared';
import { env } from '../../config/env.js';
import { startOfUtcMonth } from '../../services/llm/budget.js';
import { tokensUsedSince } from '../../services/llm/llm-usage.repository.js';
import * as repo from './sources.repository.js';

export async function getProcessingStatus(
  user: UserDto,
  projectId: string,
): Promise<ProcessingStatusDto> {
  const org = user.organizationId;
  const [documentCounts, noteCounts, activeDocuments, activeNotes, lastProcessed, tokensUsed] =
    await Promise.all([
      repo.countDocumentsByStatus(org, projectId),
      repo.countNotesByStatus(org, projectId),
      repo.listActiveDocuments(org, projectId),
      repo.listActiveNotes(org, projectId),
      repo.latestProcessedAt(org, projectId),
      tokensUsedSince(org, projectId, startOfUtcMonth(new Date())),
    ]);

  const counts: Record<SourceStatus, number> = {
    UPLOADED: 0,
    PROCESSING: 0,
    PROCESSED: 0,
    FAILED: 0,
  };
  for (const { status, count } of [...documentCounts, ...noteCounts]) {
    counts[status] += count;
  }

  return {
    counts,
    active: counts.UPLOADED + counts.PROCESSING > 0,
    lastProcessedAt: lastProcessed ? lastProcessed.toISOString() : null,
    llmPaused: tokensUsed >= env.LLM_PROJECT_MONTHLY_TOKEN_BUDGET,
    sources: [
      ...activeDocuments.map((s) => ({ type: 'document' as const, ...s })),
      ...activeNotes.map((s) => ({ type: 'note' as const, ...s })),
    ],
  };
}
