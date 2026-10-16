import type { DocumentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

const personSelect = { id: true, name: true } as const;

const versionSelect = {
  id: true,
  versionNumber: true,
  mimeType: true,
  sizeBytes: true,
  contentHash: true,
  createdAt: true,
  createdBy: { select: personSelect },
} as const;

const documentSelect = {
  id: true,
  title: true,
  fileName: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: personSelect },
  _count: { select: { versions: true } },
  versions: { select: versionSelect, orderBy: { versionNumber: 'desc' }, take: 1 },
} as const;

export type DocumentRecord = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;
export type VersionRecord = Prisma.DocumentVersionGetPayload<{ select: typeof versionSelect }>;

export interface ChunkRecord {
  id: string;
  chunkIndex: number;
  headingPath: string[];
  content: string;
}

const inProject = (organizationId: string, projectId: string) =>
  ({ organizationId, projectId, deletedAt: null }) as const;

export async function listDocuments(params: {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: DocumentRecord[]; total: number }> {
  const where = inProject(params.organizationId, params.projectId);
  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: documentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.document.count({ where }),
  ]);
  return { items, total };
}

export async function findDocument(
  organizationId: string,
  projectId: string,
  documentId: string,
  db: DbClient = prisma,
): Promise<DocumentRecord | null> {
  return db.document.findFirst({
    where: { id: documentId, ...inProject(organizationId, projectId) },
    select: documentSelect,
  });
}

export async function listVersions(
  organizationId: string,
  projectId: string,
  documentId: string,
): Promise<VersionRecord[]> {
  return prisma.documentVersion.findMany({
    where: { documentId, organizationId, document: { projectId, deletedAt: null } },
    select: versionSelect,
    orderBy: { versionNumber: 'desc' },
  });
}

export interface DownloadableVersion {
  fileKey: string;
  mimeType: string;
  versionNumber: number;
  document: { fileName: string };
}

export async function findVersionForDownload(
  organizationId: string,
  projectId: string,
  documentId: string,
  versionId: string,
): Promise<(DownloadableVersion & { id: string }) | null> {
  return prisma.documentVersion.findFirst({
    where: {
      id: versionId,
      documentId,
      organizationId,
      document: { projectId, deletedAt: null },
    },
    select: {
      id: true,
      fileKey: true,
      mimeType: true,
      versionNumber: true,
      document: { select: { fileName: true } },
    },
  });
}

/** Chunk counts keyed by document version id. */
export async function countChunksByVersion(
  organizationId: string,
  projectId: string,
  versionIds: string[],
): Promise<Map<string, number>> {
  if (versionIds.length === 0) return new Map();
  const groups = await prisma.chunk.groupBy({
    by: ['documentVersionId'],
    where: { organizationId, projectId, documentVersionId: { in: versionIds } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const group of groups) {
    if (group.documentVersionId) counts.set(group.documentVersionId, group._count._all);
  }
  return counts;
}

export async function listChunks(params: {
  organizationId: string;
  projectId: string;
  versionId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: ChunkRecord[]; total: number }> {
  const where = {
    organizationId: params.organizationId,
    projectId: params.projectId,
    documentVersionId: params.versionId,
  };
  const [items, total] = await Promise.all([
    prisma.chunk.findMany({
      where,
      select: { id: true, chunkIndex: true, headingPath: true, content: true },
      orderBy: { chunkIndex: 'asc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.chunk.count({ where }),
  ]);
  return { items, total };
}

export async function findDuplicate(
  organizationId: string,
  projectId: string,
  contentHash: string,
): Promise<{ id: string; title: string } | null> {
  const version = await prisma.documentVersion.findFirst({
    where: { contentHash, organizationId, document: { projectId, deletedAt: null } },
    select: { document: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return version?.document ?? null;
}

export async function fileKeyUsed(fileKey: string): Promise<boolean> {
  const version = await prisma.documentVersion.findUnique({
    where: { fileKey },
    select: { id: true },
  });
  return version !== null;
}

export interface NewVersion {
  documentId: string;
  organizationId: string;
  createdById: string;
  versionNumber: number;
  fileKey: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
}

export async function createDocument(
  data: {
    title: string;
    fileName: string;
    mimeType: string;
    projectId: string;
    organizationId: string;
    createdById: string;
    version: Omit<NewVersion, 'documentId' | 'versionNumber' | 'organizationId' | 'createdById'>;
  },
  db: DbClient,
): Promise<{ id: string; versionId: string }> {
  const document = await db.document.create({
    data: {
      title: data.title,
      fileName: data.fileName,
      mimeType: data.mimeType,
      status: 'UPLOADED',
      projectId: data.projectId,
      organizationId: data.organizationId,
      createdById: data.createdById,
      versions: {
        create: {
          versionNumber: 1,
          organizationId: data.organizationId,
          createdById: data.createdById,
          ...data.version,
        },
      },
    },
    select: { id: true, versions: { select: { id: true } } },
  });
  return { id: document.id, versionId: document.versions[0]?.id ?? '' };
}

/** Takes the document row lock so concurrent uploads get distinct version numbers. */
export async function lockDocument(
  organizationId: string,
  projectId: string,
  documentId: string,
  db: DbClient,
): Promise<boolean> {
  const result = await db.document.updateMany({
    where: { id: documentId, ...inProject(organizationId, projectId) },
    data: { updatedAt: new Date() },
  });
  return result.count === 1;
}

export async function nextVersionNumber(documentId: string, db: DbClient): Promise<number> {
  const result = await db.documentVersion.aggregate({
    where: { documentId },
    _max: { versionNumber: true },
  });
  return (result._max.versionNumber ?? 0) + 1;
}

export async function createVersion(data: NewVersion, db: DbClient): Promise<{ id: string }> {
  return db.documentVersion.create({ data, select: { id: true } });
}

export async function markUploaded(
  documentId: string,
  data: { fileName: string; mimeType: string },
  db: DbClient,
): Promise<void> {
  await db.document.update({
    where: { id: documentId },
    data: { ...data, status: 'UPLOADED', errorMessage: null },
  });
}

/** Moves a finished document back to UPLOADED. Returns false if it is not in a retryable state. */
export async function requeue(
  organizationId: string,
  projectId: string,
  documentId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const result = await db.document.updateMany({
    where: {
      id: documentId,
      ...inProject(organizationId, projectId),
      status: { in: ['FAILED', 'PROCESSED'] satisfies DocumentStatus[] },
    },
    data: { status: 'UPLOADED', errorMessage: null },
  });
  return result.count === 1;
}

export async function failDocument(
  organizationId: string,
  documentId: string,
  reason: string,
): Promise<void> {
  await prisma.document.updateMany({
    where: { id: documentId, organizationId, status: 'UPLOADED' },
    data: { status: 'FAILED', errorMessage: reason },
  });
}
