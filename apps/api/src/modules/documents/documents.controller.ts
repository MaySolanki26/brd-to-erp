import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import type {
  ConfirmUploadInput,
  DocumentDetailQuery,
  ListDocumentsQuery,
  UploadUrlRequest,
} from '@brd/shared';
import { getAuthUser } from '../../middleware/require-auth.js';
import * as service from './documents.service.js';

const projectIdOf = (req: Request): string => req.params['id'] as string;
const documentIdOf = (req: Request): string => req.params['docId'] as string;

export async function listDocumentsController(req: Request, res: Response): Promise<void> {
  res.json(
    await service.listDocuments(
      getAuthUser(res),
      projectIdOf(req),
      req.query as unknown as ListDocumentsQuery,
    ),
  );
}

export async function getDocumentController(req: Request, res: Response): Promise<void> {
  const document = await service.getDocument(
    getAuthUser(res),
    projectIdOf(req),
    documentIdOf(req),
    req.query as unknown as DocumentDetailQuery,
  );
  res.json({ document });
}

export async function createUploadUrlController(req: Request, res: Response): Promise<void> {
  const upload = await service.createUploadUrl(
    getAuthUser(res),
    projectIdOf(req),
    req.body as UploadUrlRequest,
  );
  res.status(201).json({ upload });
}

export async function confirmUploadController(req: Request, res: Response): Promise<void> {
  const result = await service.confirmUpload(
    getAuthUser(res),
    projectIdOf(req),
    req.body as ConfirmUploadInput,
  );
  res.status(201).json(result);
}

export async function reprocessDocumentController(req: Request, res: Response): Promise<void> {
  const document = await service.reprocessDocument(
    getAuthUser(res),
    projectIdOf(req),
    documentIdOf(req),
  );
  res.json({ document });
}

export async function downloadVersionController(req: Request, res: Response): Promise<void> {
  const file = await service.downloadVersion(
    getAuthUser(res),
    projectIdOf(req),
    documentIdOf(req),
    req.params['versionId'] as string,
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  await pipeline(file.stream, res);
}
