import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';
import type { ChunkInput } from '../../jobs/chunker.js';

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

function chunkRows(
  chunks: ChunkInput[],
  base: { projectId: string; organizationId: string },
  source: { documentVersionId: string } | { contextNoteId: string },
): Prisma.ChunkCreateManyInput[] {
  return chunks.map((chunk) => ({ ...chunk, ...base, ...source }));
}

/** Replaces the version's chunks and marks the document processed, in one transaction. */
export async function finishDocument(
  params: {
    organizationId: string;
    projectId: string;
    documentId: string;
    versionId: string;
    chunks: ChunkInput[];
  },
  db: DbClient,
): Promise<boolean> {
  const finished = await db.document.updateMany({
    where: {
      id: params.documentId,
      organizationId: params.organizationId,
      status: 'PROCESSING',
    },
    data: { status: 'PROCESSED', errorMessage: null },
  });
  if (finished.count !== 1) return false;

  await db.chunk.deleteMany({
    where: { documentVersionId: params.versionId, organizationId: params.organizationId },
  });
  await db.chunk.createMany({
    data: chunkRows(
      params.chunks,
      { projectId: params.projectId, organizationId: params.organizationId },
      { documentVersionId: params.versionId },
    ),
  });
  return true;
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
 * Replaces the note's chunks only if it was not edited while processing: an edit changes
 * updatedAt, so a stale job finds nothing to finish and writes no chunks.
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
): Promise<boolean> {
  const finished = await db.contextNote.updateMany({
    where: {
      id: params.noteId,
      organizationId: params.organizationId,
      status: 'PROCESSING',
      updatedAt: params.readAt,
    },
    data: { status: 'PROCESSED', errorMessage: null },
  });
  if (finished.count !== 1) return false;

  await db.chunk.deleteMany({
    where: { contextNoteId: params.noteId, organizationId: params.organizationId },
  });
  await db.chunk.createMany({
    data: chunkRows(
      params.chunks,
      { projectId: params.projectId, organizationId: params.organizationId },
      { contextNoteId: params.noteId },
    ),
  });
  return true;
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
