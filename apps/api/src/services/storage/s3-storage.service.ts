import type { Readable } from 'node:stream';
import type { StorageService, UploadUrlResult } from './storage.types.js';

export class S3StorageService implements StorageService {
  // TODO: accept bucket, region, credentials in constructor

  async createUploadUrl(_contentType: string): Promise<UploadUrlResult> {
    // TODO: generate S3 presigned PUT URL
    throw new Error('TODO: implement S3 storage before staging');
  }

  async confirmUpload(_fileKey: string): Promise<void> {
    // TODO: HEAD object to verify upload landed
    throw new Error('TODO: implement S3 storage before staging');
  }

  async getDownloadStream(_fileKey: string): Promise<Readable> {
    // TODO: return S3 GetObject stream
    throw new Error('TODO: implement S3 storage before staging');
  }

  async delete(_fileKey: string): Promise<void> {
    // TODO: DeleteObject call
    throw new Error('TODO: implement S3 storage before staging');
  }
}
