import type { ProcessingStatusDto, SourceStatus, UserDto } from '@brd/shared';
import * as repo from './sources.repository.js';

export async function getProcessingStatus(
  user: UserDto,
  projectId: string,
): Promise<ProcessingStatusDto> {
  const org = user.organizationId;
  const [documentCounts, noteCounts, activeDocuments, activeNotes] = await Promise.all([
    repo.countDocumentsByStatus(org, projectId),
    repo.countNotesByStatus(org, projectId),
    repo.listActiveDocuments(org, projectId),
    repo.listActiveNotes(org, projectId),
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
    sources: [
      ...activeDocuments.map((s) => ({ type: 'document' as const, ...s })),
      ...activeNotes.map((s) => ({ type: 'note' as const, ...s })),
    ],
  };
}
