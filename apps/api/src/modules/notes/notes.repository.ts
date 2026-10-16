import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DbClient } from '../../lib/transaction.js';

const noteSelect = {
  id: true,
  title: true,
  body: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export type NoteRecord = Prisma.ContextNoteGetPayload<{ select: typeof noteSelect }>;

export async function listNotes(params: {
  organizationId: string;
  projectId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: NoteRecord[]; total: number }> {
  const where = { organizationId: params.organizationId, projectId: params.projectId };
  const [items, total] = await Promise.all([
    prisma.contextNote.findMany({
      where,
      select: noteSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.contextNote.count({ where }),
  ]);
  return { items, total };
}

export async function findNote(
  organizationId: string,
  projectId: string,
  noteId: string,
  db: DbClient = prisma,
): Promise<NoteRecord | null> {
  return db.contextNote.findFirst({
    where: { id: noteId, organizationId, projectId },
    select: noteSelect,
  });
}

/** Chunk counts keyed by context note id. */
export async function countChunksByNote(
  organizationId: string,
  projectId: string,
  noteIds: string[],
): Promise<Map<string, number>> {
  if (noteIds.length === 0) return new Map();
  const groups = await prisma.chunk.groupBy({
    by: ['contextNoteId'],
    where: { organizationId, projectId, contextNoteId: { in: noteIds } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const group of groups) {
    if (group.contextNoteId) counts.set(group.contextNoteId, group._count._all);
  }
  return counts;
}

export async function createNote(
  data: {
    title: string;
    body: string;
    projectId: string;
    organizationId: string;
    createdById: string;
  },
  db: DbClient,
): Promise<NoteRecord> {
  return db.contextNote.create({ data, select: noteSelect });
}

/** An edit puts the note back in the queue so its chunks are rebuilt from the new text. */
export async function updateNote(
  noteId: string,
  data: { title?: string; body?: string },
  db: DbClient,
): Promise<NoteRecord> {
  return db.contextNote.update({
    where: { id: noteId },
    data: { ...data, status: 'UPLOADED', errorMessage: null },
    select: noteSelect,
  });
}

export async function failNote(
  organizationId: string,
  noteId: string,
  reason: string,
): Promise<void> {
  await prisma.contextNote.updateMany({
    where: { id: noteId, organizationId, status: 'UPLOADED' },
    data: { status: 'FAILED', errorMessage: reason },
  });
}
