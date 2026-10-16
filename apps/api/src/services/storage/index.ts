import { env } from '../../config/env.js';
import { LocalStorageService } from './local-storage.service.js';
import { S3StorageService } from './s3-storage.service.js';
import type { StorageService } from './storage.types.js';

export type { StorageService } from './storage.types.js';
export type { UploadUrlResult } from './storage.types.js';

function createStorageService(): StorageService {
  switch (env.STORAGE_DRIVER) {
    case 'local': {
      const basePath = env.STORAGE_LOCAL_PATH as string; // validated by superRefine
      const port = env.PORT;
      return new LocalStorageService({
        basePath,
        tokenSecret: env.STORAGE_UPLOAD_TOKEN_SECRET,
        tokenTtlSeconds: env.STORAGE_UPLOAD_TOKEN_TTL_SECONDS,
        uploadBaseUrl: `http://localhost:${String(port)}`,
      });
    }
    case 's3':
      return new S3StorageService();
  }
}

export const storageService = createStorageService();
