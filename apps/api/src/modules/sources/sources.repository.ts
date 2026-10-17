import type { DocumentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export interface StatusCount {
  status: DocumentStatus;
  count: number;
}

export interface ActiveSource {
  id: string;
  title: string;
  status: DocumentStatus;
}

const ACTIVE: DocumentStatus[] = ['UPLOADED', 'PROCESSING'];
const ACTIVE_LIMIT = 50;

export async function countDocumentsByStatus(
  organizationId: string,
  projectId: string,
): Promise<StatusCount[]> {
  const groups = await prisma.document.groupBy({
    by: ['status'],
    where: { organizationId, projectId, deletedAt: null },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function countNotesByStatus(
  organizationId: string,
  projectId: string,
): Promise<StatusCount[]> {
  const groups = await prisma.contextNote.groupBy({
    by: ['status'],
    where: { organizationId, projectId },
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function listActiveDocuments(
  organizationId: string,
  projectId: string,
): Promise<ActiveSource[]> {
  return prisma.document.findMany({
    where: { organizationId, projectId, deletedAt: null, status: { in: ACTIVE } },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: ACTIVE_LIMIT,
  });
}

export async function listActiveNotes(
  organizationId: string,
  projectId: string,
): Promise<ActiveSource[]> {
  return prisma.contextNote.findMany({
    where: { organizationId, projectId, status: { in: ACTIVE } },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: 'desc' },
    take: ACTIVE_LIMIT,
  });
}

/** The most recent time any document or note in the project reached PROCESSED, if ever. */
export async function latestProcessedAt(
  organizationId: string,
  projectId: string,
): Promise<Date | null> {
  const [document, note] = await Promise.all([
    prisma.document.aggregate({
      where: { organizationId, projectId, deletedAt: null, status: 'PROCESSED' },
      _max: { updatedAt: true },
    }),
    prisma.contextNote.aggregate({
      where: { organizationId, projectId, status: 'PROCESSED' },
      _max: { updatedAt: true },
    }),
  ]);
  const times = [document._max.updatedAt, note._max.updatedAt].filter((t): t is Date => t !== null);
  return times.length === 0 ? null : new Date(Math.max(...times.map((t) => t.getTime())));
}
