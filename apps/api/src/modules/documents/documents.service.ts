import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  JobName,
  MAX_UPLOAD_BYTES,
  sourceFileTypeOf,
  type ConfirmUploadDto,
  type ConfirmUploadInput,
  type DocumentDetailDto,
  type DocumentDetailQuery,
  type DocumentDto,
  type DocumentVersionDto,
  type ListDocumentsQuery,
  type PagedResult,
  type UploadUrlDto,
  type UploadUrlRequest,
  type UserDto,
} from '@brd/shared';
import { env } from '../../config/env.js';
import { AppError, NotFoundError, ValidationError, ConflictError } from '../../errors/app-error.js';
import { logger } from '../../lib/logger.js';
import { withTransaction } from '../../lib/transaction.js';
import { enqueueJob } from '../../services/queue.service.js';
import { storageService } from '../../services/storage/index.js';
import { readStream } from '../../services/storage/read-file.js';
import { createAuditLog } from '../audit/audit.repository.js';
import { matchesFileSignature } from './file-signature.js';
import { createUploadTicket, verifyUploadTicket } from './upload-ticket.js';
import * as repo from './documents.repository.js';

const UNSUPPORTED_TYPE = 'Unsupported file. Upload a PDF, DOCX or XLSX file.';
const QUEUE_FAILED = 'Could not queue processing. Try reprocessing in a moment.';

function toVersionDto(version: repo.VersionRecord): DocumentVersionDto {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
    contentHash: version.contentHash,
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy,
  };
}

export function toDocumentDto(document: repo.DocumentRecord, chunkCount: number): DocumentDto {
  const latest = document.versions[0];
  if (!latest) {
    throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'Document has no versions');
  }
  return {
    id: document.id,
    title: document.title,
    fileName: document.fileName,
    status: document.status,
    failureReason: document.errorMessage,
    latestVersion: toVersionDto(latest),
    versionCount: document._count.versions,
    chunkCount,
    createdBy: document.createdBy,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function toDocumentDtos(
  user: UserDto,
  projectId: string,
  documents: repo.DocumentRecord[],
): Promise<DocumentDto[]> {
  const versionIds = documents.flatMap((d) => d.versions.map((v) => v.id));
  const counts = await repo.countChunksByVersion(user.organizationId, projectId, versionIds);
  return documents.map((d) => toDocumentDto(d, counts.get(d.versions[0]?.id ?? '') ?? 0));
}

async function requireDocument(
  user: UserDto,
  projectId: string,
  documentId: string,
): Promise<repo.DocumentRecord> {
  const document = await repo.findDocument(user.organizationId, projectId, documentId);
  if (!document) {
    throw new NotFoundError('Document not found');
  }
  return document;
}

export async function listDocuments(
  user: UserDto,
  projectId: string,
  query: ListDocumentsQuery,
): Promise<PagedResult<DocumentDto>> {
  const { items, total } = await repo.listDocuments({
    organizationId: user.organizationId,
    projectId,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    items: await toDocumentDtos(user, projectId, items),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function getDocument(
  user: UserDto,
  projectId: string,
  documentId: string,
  query: DocumentDetailQuery,
): Promise<DocumentDetailDto> {
  const document = await requireDocument(user, projectId, documentId);
  const versions = await repo.listVersions(user.organizationId, projectId, documentId);
  const requested = query.versionId ? versions.find((v) => v.id === query.versionId) : versions[0];
  if (!requested) {
    throw new NotFoundError('Version not found');
  }

  const [dto] = await toDocumentDtos(user, projectId, [document]);
  const { items, total } = await repo.listChunks({
    organizationId: user.organizationId,
    projectId,
    versionId: requested.id,
    page: query.page,
    pageSize: query.pageSize,
  });
  return {
    ...(dto as DocumentDto),
    versions: versions.map(toVersionDto),
    chunksVersionId: requested.id,
    chunks: { items, page: query.page, pageSize: query.pageSize, total },
  };
}

export async function createUploadUrl(
  user: UserDto,
  projectId: string,
  input: UploadUrlRequest,
): Promise<UploadUrlDto> {
  if (!sourceFileTypeOf(input.fileName, input.mimeType)) {
    throw new ValidationError(UNSUPPORTED_TYPE);
  }
  if (input.documentId) {
    await requireDocument(user, projectId, input.documentId);
  }

  const upload = await storageService.createUploadUrl(input.mimeType);
  const ticket = createUploadTicket(env.STORAGE_UPLOAD_TOKEN_SECRET, {
    organizationId: user.organizationId,
    projectId,
    userId: user.id,
    fileKey: upload.fileKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    documentId: input.documentId,
  });
  return { uploadUrl: upload.url, ticket, expiresAt: upload.expiresAt.toISOString() };
}

async function readUploadedFile(fileKey: string): Promise<Buffer> {
  try {
    await storageService.confirmUpload(fileKey);
    return await readStream(await storageService.getDownloadStream(fileKey), MAX_UPLOAD_BYTES);
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new ValidationError('The file was not uploaded. Upload it again.');
    }
    throw err;
  }
}

async function removeStoredFile(fileKey: string): Promise<void> {
  try {
    await storageService.delete(fileKey);
  } catch (err) {
    logger.warn({ err, fileKey }, 'Could not remove rejected upload');
  }
}

async function queueProcessing(
  user: UserDto,
  projectId: string,
  documentId: string,
  versionId: string,
): Promise<boolean> {
  try {
    await enqueueJob(JobName.PROCESS_SOURCE, {
      organizationId: user.organizationId,
      projectId,
      sourceType: 'document',
      sourceId: documentId,
      versionId,
    });
    return true;
  } catch (err) {
    logger.error({ err, documentId, versionId }, 'Could not queue document processing');
    await repo.failDocument(user.organizationId, documentId, QUEUE_FAILED);
    return false;
  }
}

export async function confirmUpload(
  user: UserDto,
  projectId: string,
  input: ConfirmUploadInput,
): Promise<ConfirmUploadDto> {
  const ticket = verifyUploadTicket(env.STORAGE_UPLOAD_TOKEN_SECRET, input.ticket);
  if (
    ticket.organizationId !== user.organizationId ||
    ticket.projectId !== projectId ||
    ticket.userId !== user.id
  ) {
    throw new ValidationError('Invalid or expired upload ticket');
  }
  const fileType = sourceFileTypeOf(ticket.fileName, ticket.mimeType);
  if (!fileType) {
    throw new ValidationError(UNSUPPORTED_TYPE);
  }
  if (await repo.fileKeyUsed(ticket.fileKey)) {
    throw new ConflictError('This upload was already confirmed');
  }

  try {
    const data = await readUploadedFile(ticket.fileKey);
    if (data.length === 0 || data.length !== ticket.sizeBytes) {
      throw new ValidationError('The uploaded file does not match the declared size');
    }
    if (!matchesFileSignature(fileType, data)) {
      throw new ValidationError('The file content does not match its type');
    }

    const contentHash = createHash('sha256').update(data).digest('hex');
    const duplicate = await repo.findDuplicate(user.organizationId, projectId, contentHash);
    const { documentId, versionId } = await persistUpload(user, projectId, ticket, contentHash);

    const queued = await queueProcessing(user, projectId, documentId, versionId);
    const document = await requireDocument(user, projectId, documentId);
    const [dto] = await toDocumentDtos(user, projectId, [document]);
    if (!queued) {
      logger.warn({ documentId }, 'Document stored but not queued');
    }
    return {
      document: dto as DocumentDto,
      duplicateOf: duplicate ? { documentId: duplicate.id, title: duplicate.title } : null,
    };
  } catch (err) {
    if (err instanceof ValidationError) {
      await removeStoredFile(ticket.fileKey);
    }
    throw err;
  }
}

async function persistUpload(
  user: UserDto,
  projectId: string,
  ticket: ReturnType<typeof verifyUploadTicket>,
  contentHash: string,
): Promise<{ documentId: string; versionId: string }> {
  const version = {
    fileKey: ticket.fileKey,
    contentHash,
    mimeType: ticket.mimeType,
    sizeBytes: ticket.sizeBytes,
  };

  return withTransaction(async (tx) => {
    let documentId: string;
    let versionId: string;
    let versionNumber = 1;

    if (ticket.documentId) {
      documentId = ticket.documentId;
      if (!(await repo.lockDocument(user.organizationId, projectId, documentId, tx))) {
        throw new NotFoundError('Document not found');
      }
      versionNumber = await repo.nextVersionNumber(documentId, tx);
      versionId = (
        await repo.createVersion(
          {
            ...version,
            documentId,
            versionNumber,
            organizationId: user.organizationId,
            createdById: user.id,
          },
          tx,
        )
      ).id;
      await repo.markUploaded(
        documentId,
        { fileName: ticket.fileName, mimeType: ticket.mimeType },
        tx,
      );
    } else {
      const created = await repo.createDocument(
        {
          title: ticket.fileName,
          fileName: ticket.fileName,
          mimeType: ticket.mimeType,
          projectId,
          organizationId: user.organizationId,
          createdById: user.id,
          version,
        },
        tx,
      );
      documentId = created.id;
      versionId = created.versionId;
    }

    await createAuditLog(
      {
        action: ticket.documentId ? 'UPDATE' : 'CREATE',
        entity: 'Document',
        entityId: documentId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { projectId, versionNumber, sizeBytes: ticket.sizeBytes },
      },
      tx,
    );
    return { documentId, versionId };
  });
}

export async function reprocessDocument(
  user: UserDto,
  projectId: string,
  documentId: string,
): Promise<DocumentDto> {
  const document = await requireDocument(user, projectId, documentId);
  const latest = document.versions[0];
  if (!latest) {
    throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'Document has no versions');
  }
  if (!(await repo.requeue(user.organizationId, projectId, documentId))) {
    throw new ConflictError('Only processed or failed documents can be reprocessed');
  }

  await createAuditLog({
    action: 'UPDATE',
    entity: 'Document',
    entityId: documentId,
    userId: user.id,
    organizationId: user.organizationId,
    metadata: { projectId, reprocess: true, versionId: latest.id },
  });
  if (!(await queueProcessing(user, projectId, documentId, latest.id))) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', QUEUE_FAILED);
  }

  const refreshed = await requireDocument(user, projectId, documentId);
  const [dto] = await toDocumentDtos(user, projectId, [refreshed]);
  return dto as DocumentDto;
}

export interface DownloadResult {
  stream: Readable;
  fileName: string;
  mimeType: string;
}

export async function downloadVersion(
  user: UserDto,
  projectId: string,
  documentId: string,
  versionId: string,
): Promise<DownloadResult> {
  const version = await repo.findVersionForDownload(
    user.organizationId,
    projectId,
    documentId,
    versionId,
  );
  if (!version) {
    throw new NotFoundError('Version not found');
  }
  const stream = await storageService.getDownloadStream(version.fileKey);
  await createAuditLog({
    action: 'EXPORT',
    entity: 'DocumentVersion',
    entityId: version.id,
    userId: user.id,
    organizationId: user.organizationId,
    metadata: { projectId, documentId },
  });
  return { stream, fileName: version.document.fileName, mimeType: version.mimeType };
}
