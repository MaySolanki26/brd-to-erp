import type { Prisma } from '@prisma/client';
import type { KnowledgeSourceDto } from '@brd/shared';
import type { ChunkRecord } from './knowledge.repository.js';

/** The fields of a chunk needed to say where an item came from. Shared by every query that links to a source. */
export const chunkSelect = {
  id: true,
  headingPath: true,
  needsReview: true,
  documentVersion: {
    select: { versionNumber: true, document: { select: { id: true, title: true } } },
  },
  contextNote: { select: { id: true, title: true } },
} satisfies Prisma.ChunkSelect;

/** Where an item came from, in the shape every screen that links to a source needs. */
export function toSource(chunk: ChunkRecord): KnowledgeSourceDto {
  const base = {
    chunkId: chunk.id,
    headingPath: chunk.headingPath,
    needsReview: chunk.needsReview,
  };
  if (chunk.documentVersion) {
    return {
      ...base,
      type: 'document',
      sourceId: chunk.documentVersion.document.id,
      sourceTitle: chunk.documentVersion.document.title,
      versionNumber: chunk.documentVersion.versionNumber,
    };
  }
  return {
    ...base,
    type: 'note',
    sourceId: chunk.contextNote?.id ?? '',
    sourceTitle: chunk.contextNote?.title ?? '',
    versionNumber: null,
  };
}
