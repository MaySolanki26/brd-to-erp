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

export type ProcessOutcome = 'processed' | 'extracting' | 'skipped' | 'failed' | 'superseded';

export interface ProcessResult {
  outcome: ProcessOutcome;
  /** For `extracting`: the chunks the extraction job must read. */
  chunkIds: string[];
}

const done = (outcome: Exclude<ProcessOutcome, 'extracting'>): ProcessResult => ({
  outcome,
  chunkIds: [],
});

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
): Promise<ProcessResult> {
  if (err instanceof PermanentJobError) {
    log.warn({ reason: err.message }, 'Source cannot be processed');
    await handlers.fail(err.message);
    return done('failed');
  }
  if (err instanceof NotFoundError) {
    log.warn('Stored file is missing');
    await handlers.fail(UNREADABLE_FILE);
    return done('failed');
  }
  if (attempt.isLastAttempt) {
    log.error({ err }, 'Processing failed after the last attempt');
    await handlers.fail(GENERIC_FAILURE);
    return done('failed');
  }
  log.warn({ err }, 'Processing failed, will retry');
  await handlers.release();
  throw err;
}

function resultOf(
  synced: repo.SyncResult | null,
  chunkCount: number,
  log: typeof logger,
): ProcessResult {
  if (!synced) return done('superseded');
  log.info(
    { chunkCount, toExtract: synced.pendingChunkIds.length, finished: synced.finished },
    'Source chunked',
  );
  return synced.finished
    ? done('processed')
    : { outcome: 'extracting', chunkIds: synced.pendingChunkIds };
}

async function processDocument(
  payload: ProcessSourcePayload,
  attempt: JobAttempt,
  log: typeof logger,
): Promise<ProcessResult> {
  const { organizationId, projectId, sourceId: documentId, versionId } = payload;
  if (!versionId) return done('skipped');

  const version = await repo.findVersion({ organizationId, projectId, documentId, versionId });
  if (!version) {
    log.warn('Document or version not found for this organization and project');
    return done('skipped');
  }
  const claimed = await repo.beginDocument({
    organizationId,
    projectId,
    documentId,
    versionNumber: version.versionNumber,
  });
  if (!claimed) {
    log.info({ status: version.documentStatus }, 'Document not waiting for this version, skipping');
    return done('superseded');
  }

  try {
    const fileType = fileTypeFromMime(version.mimeType);
    if (!fileType) throw new PermanentJobError(UNREADABLE_FILE);

    const data = await readStream(
      await storageService.getDownloadStream(version.fileKey),
      MAX_UPLOAD_BYTES,
    );
    const chunks: ChunkInput[] = chunkSections(version.versionId, await parseFile(fileType, data));

    const synced = await withTransaction((tx) =>
      repo.finishDocument(
        {
          organizationId,
          projectId,
          documentId,
          versionId,
          versionNumber: version.versionNumber,
          chunks,
          reextract: payload.reextract === true,
        },
        tx,
      ),
    );
    return resultOf(synced, chunks.length, log);
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
): Promise<ProcessResult> {
  const { organizationId, projectId, sourceId: noteId } = payload;

  const found = await repo.findNote({ organizationId, projectId, noteId });
  if (!found) {
    log.warn('Note not found for this organization and project');
    return done('skipped');
  }
  if (!(await repo.beginNote({ organizationId, projectId, noteId }))) {
    log.info({ status: found.status }, 'Note not waiting to be processed, skipping');
    return done('superseded');
  }

  try {
    // Read after claiming: the claim bumped updatedAt, and any later edit will change it again.
    const note = await repo.findNote({ organizationId, projectId, noteId });
    if (!note) return done('skipped');

    const chunks = chunkSections(note.id, parseNote(note.title, note.body));
    const synced = await withTransaction((tx) =>
      repo.finishNote({ organizationId, projectId, noteId, readAt: note.updatedAt, chunks }, tx),
    );
    return resultOf(synced, chunks.length, log);
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

/** Fails a source that is past its claim and cannot continue, so a person can reprocess it. */
export async function failSource(payload: ProcessSourcePayload, reason: string): Promise<void> {
  if (payload.sourceType === 'document') {
    await repo.failDocument(payload.organizationId, payload.sourceId, reason);
  } else {
    await repo.failNote(payload.organizationId, payload.sourceId, reason);
  }
}

export async function processSource(
  payload: ProcessSourcePayload,
  attempt: JobAttempt,
): Promise<ProcessResult> {
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
