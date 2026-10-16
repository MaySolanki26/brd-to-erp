import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../errors/app-error.js';
import { verifyUploadToken } from '../../services/storage/storage-token.js';
import { storageService } from '../../services/storage/index.js';
import { LocalStorageService } from '../../services/storage/local-storage.service.js';
import { env } from '../../config/env.js';

export async function handleUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.query['token'];
    if (typeof token !== 'string' || token.length === 0) {
      throw new ValidationError('Missing upload token');
    }

    const { fileKey } = verifyUploadToken(env.STORAGE_UPLOAD_TOKEN_SECRET, token);

    if (!(storageService instanceof LocalStorageService)) {
      throw new ValidationError('Upload endpoint is only available for local storage driver');
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ValidationError('Request body is empty');
    }

    await storageService.writeFile(fileKey, body);
    res.status(201).json({ fileKey });
  } catch (err) {
    next(err);
  }
}

export async function handleDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fileKey = req.params['fileKey'] as string | undefined;
    if (!fileKey) {
      throw new ValidationError('Missing fileKey parameter');
    }

    const stream = await storageService.getDownloadStream(fileKey);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileKey}"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}
