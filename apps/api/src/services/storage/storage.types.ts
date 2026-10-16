import type { Readable } from 'node:stream';

export interface UploadUrlResult {
  /** URL the client POSTs the file to */
  url: string;
  /** UUID key identifying the stored file */
  fileKey: string;
  /** When the upload URL expires */
  expiresAt: Date;
}

export interface StorageService {
  createUploadUrl(contentType: string): Promise<UploadUrlResult>;
  confirmUpload(fileKey: string): Promise<void>;
  getDownloadStream(fileKey: string): Promise<Readable>;
  delete(fileKey: string): Promise<void>;
}
