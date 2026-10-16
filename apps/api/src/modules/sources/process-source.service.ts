import type { ProcessSourcePayload } from '@brd/shared';
import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { chunkSections, type ChunkInput } from '../../jobs/chunker.js';
import { NotFoundError } from '../../errors/app-error.js';
import { PermanentJobError, UNREADABLE_FILE } from '../../jobs/errors.js';
import { fileTypeFromMime, parseFile, parseNote } from '../../jobs/parsers/index.js';
import { logger } from '../../lib/logger.js';
import { withTransaction } from '../../lib/transaction.js';
import { storageService } from '../../services/storage/index.js';
import { readStream } from '../../services/storage/read-file.js';
import * as repo from './process-source.repository.js';

export type ProcessOutcome = 'processed' | 'skipped' | 'failed' | 'superseded';

export interface JobAttempt {
  jobId: string;
  /** True when pg-boss will not retry this job again. */
  isLastAttempt: boolean;
}

const GENERIC_FAILURE = 'Processing failed. Try reprocessing.';

interface SourceHandlers {
  fail: (reason: string) => Promise<void>;
  release: () => Promise<void>;
}

/** Permanent errors fail the source for good; transient ones release it and rethrow for retry. */
async function handleFailure(
  err: unknown,
  attempt: JobAttempt,
  handlers: SourceHandlers,
  log: typeof logger,
): Promise<ProcessOutcome> {
  if (err instanceof PermanentJobError) {
    log.warn({ reason: err.message }, 'Source cannot be processed');
    await handlers.fail(err.message);
    return 'failed';
  }
  if (err instanceof NotFoundError) {
    log.warn('Stored file is missing');
    await handlers.fail(UNREADABLE_FILE);
    return 'failed';
  }
  if (attempt.isLastAttempt) {
    log.error({ err }, 'Processing failed after the last attempt');
    await handlers.fail(GENERIC_FAILURE);
    return 'failed';
  }
  log.warn({ err }, 'Processing failed, will retry');
  await handlers.release();
  throw err;
}

async function processDocument(
  payload: ProcessSourcePayload,
  attempt: JobAttempt,
  log: typeof logger,
): Promise<ProcessOutcome> {
  const { organizationId, projectId, sourceId: documentId, versionId } = payload;
  if (!versionId) return 'skipped';

  const version = await repo.findVersion({ organizationId, projectId, documentId, versionId });
  if (!version) {
    log.warn('Document or version not found for this organization and project');
    return 'skipped';
  }
  const claimed = await repo.beginDocument({
    organizationId,
    projectId,
    documentId,
    versionNumber: version.versionNumber,
  });
  if (!claimed) {
    log.info({ status: version.documentStatus }, 'Document not waiting for this version, skipping');
    return 'superseded';
  }

  try {
    const fileType = fileTypeFromMime(version.mimeType);
    if (!fileType) throw new PermanentJobError(UNREADABLE_FILE);

    const data = await readStream(
      await storageService.getDownloadStream(version.fileKey),
      MAX_UPLOAD_BYTES,
    );
    const chunks: ChunkInput[] = chunkSections(version.versionId, await parseFile(fileType, data));

    const finished = await withTransaction((tx) =>
      repo.finishDocument({ organizationId, projectId, documentId, versionId, chunks }, tx),
    );
    log.info({ chunkCount: chunks.length, finished }, 'Document processed');
    return finished ? 'processed' : 'superseded';
  } catch (err) {
    return handleFailure(
      err,
      attempt,
      {
        fail: (reason) => repo.failDocument(organizationId, documentId, reason),
        release: () => repo.releaseDocument(organizationId, documentId),
      },
      log,
    );
  }
}

async function processNote(
  payload: ProcessSourcePayload,
  attempt: JobAttempt,
  log: typeof logger,
): Promise<ProcessOutcome> {
  const { organizationId, projectId, sourceId: noteId } = payload;

  const found = await repo.findNote({ organizationId, projectId, noteId });
  if (!found) {
    log.warn('Note not found for this organization and project');
    return 'skipped';
  }
  if (!(await repo.beginNote({ organizationId, projectId, noteId }))) {
    log.info({ status: found.status }, 'Note not waiting to be processed, skipping');
    return 'superseded';
  }

  try {
    // Read after claiming: the claim bumped updatedAt, and any later edit will change it again.
    const note = await repo.findNote({ organizationId, projectId, noteId });
    if (!note) return 'skipped';

    const chunks = chunkSections(note.id, parseNote(note.title, note.body));
    const finished = await withTransaction((tx) =>
      repo.finishNote({ organizationId, projectId, noteId, readAt: note.updatedAt, chunks }, tx),
    );
    log.info({ chunkCount: chunks.length, finished }, 'Note processed');
    return finished ? 'processed' : 'superseded';
  } catch (err) {
    return handleFailure(
      err,
      attempt,
      {
        fail: (reason) => repo.failNote(organizationId, noteId, reason),
        release: () => repo.releaseNote(organizationId, noteId),
      },
      log,
    );
  }
}

export async function processSource(
  payload: ProcessSourcePayload,
  attempt: JobAttempt,
): Promise<ProcessOutcome> {
  const log = logger.child({
    jobId: attempt.jobId,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    projectId: payload.projectId,
    organizationId: payload.organizationId,
  });
  return payload.sourceType === 'document'
    ? processDocument(payload, attempt, log)
    : processNote(payload, attempt, log);
}
