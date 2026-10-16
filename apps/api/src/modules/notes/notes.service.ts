import {
  JobName,
  type ContextNoteDto,
  type CreateNoteInput,
  type ListNotesQuery,
  type PagedResult,
  type UpdateNoteInput,
  type UserDto,
} from '@brd/shared';
import { NotFoundError } from '../../errors/app-error.js';
import { logger } from '../../lib/logger.js';
import { withTransaction } from '../../lib/transaction.js';
import { enqueueJob } from '../../services/queue.service.js';
import { createAuditLog } from '../audit/audit.repository.js';
import * as repo from './notes.repository.js';

const QUEUE_FAILED = 'Could not queue processing. Edit the note again to retry.';

export function toNoteDto(note: repo.NoteRecord, chunkCount: number): ContextNoteDto {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    status: note.status,
    failureReason: note.errorMessage,
    chunkCount,
    createdBy: note.createdBy,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function toNoteDtos(
  user: UserDto,
  projectId: string,
  notes: repo.NoteRecord[],
): Promise<ContextNoteDto[]> {
  const counts = await repo.countChunksByNote(
    user.organizationId,
    projectId,
    notes.map((n) => n.id),
  );
  return notes.map((n) => toNoteDto(n, counts.get(n.id) ?? 0));
}

async function queueProcessing(user: UserDto, projectId: string, noteId: string): Promise<void> {
  try {
    await enqueueJob(JobName.PROCESS_SOURCE, {
      organizationId: user.organizationId,
      projectId,
      sourceType: 'note',
      sourceId: noteId,
    });
  } catch (err) {
    logger.error({ err, noteId }, 'Could not queue note processing');
    await repo.failNote(user.organizationId, noteId, QUEUE_FAILED);
  }
}

async function reload(user: UserDto, projectId: string, noteId: string): Promise<ContextNoteDto> {
  const note = await repo.findNote(user.organizationId, projectId, noteId);
  if (!note) {
    throw new NotFoundError('Note not found');
  }
  const [dto] = await toNoteDtos(user, projectId, [note]);
  return dto as ContextNoteDto;
}

export async function listNotes(
  user: UserDto,
  projectId: string,
  query: ListNotesQuery,
): Promise<PagedResult<ContextNoteDto>> {
  const { items, total } = await repo.listNotes({
    organizationId: user.organizationId,
    projectId,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    items: await toNoteDtos(user, projectId, items),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function createNote(
  user: UserDto,
  projectId: string,
  input: CreateNoteInput,
): Promise<ContextNoteDto> {
  const note = await withTransaction(async (tx) => {
    const created = await repo.createNote(
      { ...input, projectId, organizationId: user.organizationId, createdById: user.id },
      tx,
    );
    await createAuditLog(
      {
        action: 'CREATE',
        entity: 'ContextNote',
        entityId: created.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId },
      },
      tx,
    );
    return created;
  });
  await queueProcessing(user, projectId, note.id);
  return reload(user, projectId, note.id);
}

export async function updateNote(
  user: UserDto,
  projectId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<ContextNoteDto> {
  await withTransaction(async (tx) => {
    if (!(await repo.findNote(user.organizationId, projectId, noteId, tx))) {
      throw new NotFoundError('Note not found');
    }
    await repo.updateNote(noteId, input, tx);
    await createAuditLog(
      {
        action: 'UPDATE',
        entity: 'ContextNote',
        entityId: noteId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId },
      },
      tx,
    );
  });
  await queueProcessing(user, projectId, noteId);
  return reload(user, projectId, noteId);
}
