import { createReadStream } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../errors/app-error.js';
import { createUploadToken } from './storage-token.js';
import type { StorageService, UploadUrlResult } from './storage.types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LocalStorageService implements StorageService {
  private readonly basePath: string;
  private readonly tokenSecret: string;
  private readonly tokenTtlSeconds: number;
  private readonly uploadBaseUrl: string;

  constructor(opts: {
    basePath: string;
    tokenSecret: string;
    tokenTtlSeconds: number;
    uploadBaseUrl: string;
  }) {
    this.basePath = resolve(opts.basePath);
    this.tokenSecret = opts.tokenSecret;
    this.tokenTtlSeconds = opts.tokenTtlSeconds;
    this.uploadBaseUrl = opts.uploadBaseUrl;
  }

  async init(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  async createUploadUrl(contentType: string): Promise<UploadUrlResult> {
    const fileKey = randomUUID();
    const token = createUploadToken(this.tokenSecret, fileKey, contentType, this.tokenTtlSeconds);
    const url = `${this.uploadBaseUrl}/storage/upload?token=${encodeURIComponent(token)}`;
    const expiresAt = new Date(Date.now() + this.tokenTtlSeconds * 1000);

    return { url, fileKey, expiresAt };
  }

  async confirmUpload(fileKey: string): Promise<void> {
    const filePath = this.resolveFilePath(fileKey);
    try {
      await access(filePath);
    } catch {
      throw new NotFoundError(`File not found: ${fileKey}`);
    }
  }

  async getDownloadStream(fileKey: string): Promise<Readable> {
    const filePath = this.resolveFilePath(fileKey);
    try {
      await access(filePath);
    } catch {
      throw new NotFoundError(`File not found: ${fileKey}`);
    }
    return createReadStream(filePath);
  }

  async delete(fileKey: string): Promise<void> {
    const filePath = this.resolveFilePath(fileKey);
    try {
      await unlink(filePath);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return;
      }
      throw err;
    }
  }

  /** Write raw bytes to the file key's path. Used by the upload controller. */
  async writeFile(fileKey: string, data: Buffer): Promise<void> {
    const filePath = this.resolveFilePath(fileKey);
    await writeFile(filePath, data);
  }

  private resolveFilePath(fileKey: string): string {
    if (!UUID_RE.test(fileKey)) {
      throw new ValidationError('Invalid file key');
    }
    const filePath = join(this.basePath, fileKey);
    if (!filePath.startsWith(this.basePath)) {
      throw new ValidationError('Invalid file key');
    }
    return filePath;
  }
}
