import type { Readable } from 'node:stream';
import { ServiceUnavailableError } from '../../errors/app-error.js';
import type { StorageService, UploadUrlResult } from './storage.types.js';

const NOT_AVAILABLE = 'S3 storage is not available yet. Use STORAGE_DRIVER=local.';

/** Placeholder so STORAGE_DRIVER=s3 fails loudly with a typed error until the driver exists. */
export class S3StorageService implements StorageService {
  createUploadUrl(_contentType: string): Promise<UploadUrlResult> {
    return Promise.reject(new ServiceUnavailableError(NOT_AVAILABLE));
  }

  confirmUpload(_fileKey: string): Promise<void> {
    return Promise.reject(new ServiceUnavailableError(NOT_AVAILABLE));
  }

  getDownloadStream(_fileKey: string): Promise<Readable> {
    return Promise.reject(new ServiceUnavailableError(NOT_AVAILABLE));
  }

  delete(_fileKey: string): Promise<void> {
    return Promise.reject(new ServiceUnavailableError(NOT_AVAILABLE));
  }
}
