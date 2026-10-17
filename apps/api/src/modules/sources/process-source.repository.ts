import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import type { ChunkInput } from '../../jobs/chunker.js';
import { markOlderVersionItems, releaseChunkItems } from '../extraction/extraction.repository.js';

export interface SourceVersionRecord {
  documentId: string;
  versionId: string;
  versionNumber: number;
  fileKey: string;
  mimeType: string;
  documentStatus: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
}

export interface SourceNoteRecord {
  id: string;
  title: string;
  body: string;
  status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  updatedAt: Date;
}

/** Loads the version only if it belongs to the document, project and organization in the job. */
export async function findVersion(params: {
  organizationId: string;
  projectId: string;
  documentId: string;
  versionId: string;
}): Promise<SourceVersionRecord | null> {
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: params.versionId,
      documentId: params.documentId,
      organizationId: params.organizationId,
      document: {
        id: params.documentId,
        projectId: params.projectId,
        organizationId: params.organizationId,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      versionNumber: true,
      fileKey: true,
      mimeType: true,
      document: { select: { id: true, status: true } },
    },
  });
  if (!version) return null;
  return {
    documentId: version.document.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    fileKey: version.fileKey,
    mimeType: version.mimeType,
    documentStatus: version.document.status,
  };
}

/**
 * UPLOADED -> PROCESSING, but only while this is still the newest version, so a job for a
 * superseded version can never block the job for the current one.
 */
export async function beginDocument(params: {
  organizationId: string;
  projectId: string;
  documentId: string;
  versionNumber: number;
}): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: {
      id: params.documentId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      deletedAt: null,
      status: 'UPLOADED',
      versions: { none: { versionNumber: { gt: params.versionNumber } } },
    },
    data: { status: 'PROCESSING', errorMessage: null },
  });
  return result.count === 1;
}

type ChunkSource = { documentVersionId: string } | { contextNoteId: string };
type Scope = { organizationId: string; projectId: string };

/** Chunks whose text disappeared but still hold confirmed or person-made items move out of the way. */
const STALE_INDEX_BASE = 1_000_000;

export interface SyncResult {
  /** Chunks the extraction job must still read, in reading order. */
  pendingChunkIds: string[];
  /** The source has nothing left to extract and is now processed. */
  finished: boolean;
}

/**
 * Makes the source's stored chunks match `chunks` without disturbing what is already known:
 * a chunk whose key is unchanged stays (with its extraction state), a vanished one gives up its
 * unconfirmed items and is deleted, and only a new key becomes a new row. `reextract` forgets that
 * the kept chunks were extracted, so a reprocess reads them again.
 */
async function syncChunks(
  db: DbClient,
  scope: Scope,
  source: ChunkSource,
  chunks: ChunkInput[],
  reextract: boolean,
): Promise<string[]> {
  const where = { ...source, organizationId: scope.organizationId };
  const stored = await db.chunk.findMany({
    where,
    select: { id: true, chunkKey: true, chunkIndex: true },
  });
  const indexOfKey = new Map(chunks.map((chunk) => [chunk.chunkKey, chunk.chunkIndex]));
  const wanted = new Set(indexOfKey.keys());
  const kept = new Set(stored.filter((chunk) => wanted.has(chunk.chunkKey)).map((c) => c.chunkKey));

  let staleIndex = Math.max(STALE_INDEX_BASE, ...stored.map((chunk) => chunk.chunkIndex + 1));
  for (const chunk of stored.filter((c) => !wanted.has(c.chunkKey))) {
    if (await releaseChunkItems(db, scope, chunk.id)) {
      await db.chunk.delete({ where: { id: chunk.id } });
    } else if (chunk.chunkIndex < STALE_INDEX_BASE) {
      await db.chunk.update({ where: { id: chunk.id }, data: { chunkIndex: staleIndex } });
      staleIndex += 1;
    }
  }

  // A chunk that was pushed aside earlier and whose text is back returns to its place.
  for (const chunk of stored) {
    const index = indexOfKey.get(chunk.chunkKey);
    if (index !== undefined && index !== chunk.chunkIndex) {
      await db.chunk.update({ where: { id: chunk.id }, data: { chunkIndex: index } });
    }
  }

  await db.chunk.createMany({
    data: chunkRows(chunks.filter((chunk) => !kept.has(chunk.chunkKey)), scope, source),
  });
  if (reextract) {
    await db.chunk.updateMany({ where, data: { extractedAt: null } });
  }

  const pending = await db.chunk.findMany({
    where: { ...where, extractedAt: null, chunkIndex: { lt: STALE_INDEX_BASE } },
    select: { id: true },
    orderBy: { chunkIndex: 'asc' },
  });
  return pending.map((chunk) => chunk.id);
}

function chunkRows(
  chunks: ChunkInput[],
  base: Scope,
  source: ChunkSource,
): Prisma.ChunkCreateManyInput[] {
  return chunks.map((chunk) => ({ ...chunk, ...base, ...source }));
}

/**
 * Syncs the version's chunks while the document is still processing. When no chunk needs reading the
 * document is processed now; otherwise it stays processing until the last chunk is extracted.
 * Returns null when the document is no longer waiting on this job.
 */
export async function finishDocument(
  params: {
    organizationId: string;
    projectId: string;
    documentId: string;
    versionId: string;
    versionNumber: number;
    chunks: ChunkInput[];
    reextract: boolean;
  },
  db: DbClient,
): Promise<SyncResult | null> {
  const scope = { organizationId: params.organizationId, projectId: params.projectId };
  const waiting = await db.document.count({
    where: { id: params.documentId, organizationId: params.organizationId, status: 'PROCESSING' },
  });
  if (waiting !== 1) return null;

  if (params.versionNumber > 1) {
    await markOlderVersionItems(db, scope, params.documentId, params.versionNumber);
  }
  const pendingChunkIds = await syncChunks(
    db,
    scope,
    { documentVersionId: params.versionId },
    params.chunks,
    params.reextract,
  );
  if (pendingChunkIds.length > 0) return { pendingChunkIds, finished: false };

  await db.document.updateMany({
    where: { id: params.documentId, organizationId: params.organizationId, status: 'PROCESSING' },
    data: { status: 'PROCESSED', errorMessage: null },
  });
  return { pendingChunkIds, finished: true };
}

export async function findNote(params: {
  organizationId: string;
  projectId: string;
  noteId: string;
}): Promise<SourceNoteRecord | null> {
  return prisma.contextNote.findFirst({
    where: {
      id: params.noteId,
      organizationId: params.organizationId,
      projectId: params.projectId,
    },
    select: { id: true, title: true, body: true, status: true, updatedAt: true },
  });
}

export async function beginNote(params: {
  organizationId: string;
  projectId: string;
  noteId: string;
}): Promise<boolean> {
  const result = await prisma.contextNote.updateMany({
    where: {
      id: params.noteId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      status: 'UPLOADED',
    },
    data: { status: 'PROCESSING', errorMessage: null },
  });
  return result.count === 1;
}

/**
 * Syncs the note's chunks only if it was not edited while processing: an edit changes updatedAt, so a
 * stale job finds nothing to finish and writes no chunks. Like a document, the note is processed now
 * when no chunk needs reading and otherwise when the last one is extracted.
 */
export async function finishNote(
  params: {
    organizationId: string;
    projectId: string;
    noteId: string;
    readAt: Date;
    chunks: ChunkInput[];
  },
  db: DbClient,
): Promise<SyncResult | null> {
  const scope = { organizationId: params.organizationId, projectId: params.projectId };
  const waiting = await db.contextNote.count({
    where: {
      id: params.noteId,
      organizationId: params.organizationId,
      status: 'PROCESSING',
      updatedAt: params.readAt,
    },
  });
  if (waiting !== 1) return null;

  const pendingChunkIds = await syncChunks(
    db,
    scope,
    { contextNoteId: params.noteId },
    params.chunks,
    false,
  );
  if (pendingChunkIds.length > 0) return { pendingChunkIds, finished: false };

  await db.contextNote.updateMany({
    where: { id: params.noteId, organizationId: params.organizationId, status: 'PROCESSING' },
    data: { status: 'PROCESSED', errorMessage: null },
  });
  return { pendingChunkIds, finished: true };
}

export async function failDocument(
  organizationId: string,
  documentId: string,
  reason: string,
): Promise<void> {
  await prisma.document.updateMany({
    where: { id: documentId, organizationId, status: 'PROCESSING' },
    data: { status: 'FAILED', errorMessage: reason },
  });
}

export async function failNote(
  organizationId: string,
  noteId: string,
  reason: string,
): Promise<void> {
  await prisma.contextNote.updateMany({
    where: { id: noteId, organizationId, status: 'PROCESSING' },
    data: { status: 'FAILED', errorMessage: reason },
  });
}

/** Puts a source back in the queue state so the retry's begin step can claim it. */
export async function releaseDocument(organizationId: string, documentId: string): Promise<void> {
  await prisma.document.updateMany({
    where: { id: documentId, organizationId, status: 'PROCESSING' },
    data: { status: 'UPLOADED' },
  });
}

export async function releaseNote(organizationId: string, noteId: string): Promise<void> {
  await prisma.contextNote.updateMany({
    where: { id: noteId, organizationId, status: 'PROCESSING' },
    data: { status: 'UPLOADED' },
  });
}
