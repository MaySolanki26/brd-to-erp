import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service.js';
import { createUploadToken, verifyUploadToken } from './storage-token.js';

const TOKEN_SECRET = 'test-secret-at-least-16-chars';
const TOKEN_TTL = 300;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

describe('LocalStorageService', () => {
  let tempDir: string;
  let service: LocalStorageService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'brd-storage-test-'));
    service = new LocalStorageService({
      basePath: tempDir,
      tokenSecret: TOKEN_SECRET,
      tokenTtlSeconds: TOKEN_TTL,
      uploadBaseUrl: 'http://localhost:3001',
    });
    await service.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createUploadUrl', () => {
    it('returns a URL with a token, a UUID fileKey, and an expiry', async () => {
      const result = await service.createUploadUrl('application/pdf');

      expect(result.fileKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.url).toContain('/storage/upload?token=');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('produces a token that verifies correctly', async () => {
      const result = await service.createUploadUrl('image/png');
      const url = new URL(result.url);
      const token = url.searchParams.get('token');
      expect(token).toBeTruthy();

      const verified = verifyUploadToken(TOKEN_SECRET, token as string);
      expect(verified.fileKey).toBe(result.fileKey);
      expect(verified.contentType).toBe('image/png');
    });
  });

  describe('full upload flow', () => {
    it('writes, confirms, reads, and deletes a file', async () => {
      const { fileKey } = await service.createUploadUrl('text/plain');
      const content = Buffer.from('hello world');

      await service.writeFile(fileKey, content);
      await service.confirmUpload(fileKey);

      const stream = await service.getDownloadStream(fileKey);
      const downloaded = await streamToBuffer(stream);
      expect(downloaded.toString()).toBe('hello world');

      await service.delete(fileKey);

      await expect(service.confirmUpload(fileKey)).rejects.toThrow('File not found');
    });
  });

  describe('confirmUpload', () => {
    it('throws NotFoundError for a non-existent file', async () => {
      const { fileKey } = await service.createUploadUrl('text/plain');
      await expect(service.confirmUpload(fileKey)).rejects.toThrow('File not found');
    });
  });

  describe('getDownloadStream', () => {
    it('throws NotFoundError for a non-existent file', async () => {
      const { fileKey } = await service.createUploadUrl('text/plain');
      await expect(service.getDownloadStream(fileKey)).rejects.toThrow('File not found');
    });
  });

  describe('delete', () => {
    it('does not throw when deleting a non-existent file', async () => {
      const { fileKey } = await service.createUploadUrl('text/plain');
      await expect(service.delete(fileKey)).resolves.toBeUndefined();
    });
  });

  describe('path traversal protection', () => {
    it('rejects a fileKey with path traversal characters', async () => {
      await expect(service.confirmUpload('../etc/passwd')).rejects.toThrow('Invalid file key');
      await expect(service.getDownloadStream('../../secret')).rejects.toThrow('Invalid file key');
      await expect(service.delete('foo/../../bar')).rejects.toThrow('Invalid file key');
    });

    it('rejects a fileKey that is not a valid UUID', async () => {
      await expect(service.confirmUpload('not-a-uuid')).rejects.toThrow('Invalid file key');
      await expect(service.getDownloadStream('12345')).rejects.toThrow('Invalid file key');
      await expect(service.delete('')).rejects.toThrow('Invalid file key');
    });
  });
});

describe('storage-token', () => {
  const secret = 'test-token-secret-long-enough';

  describe('verifyUploadToken', () => {
    it('rejects a tampered token', () => {
      const token = createUploadToken(
        secret,
        '550e8400-e29b-41d4-a716-446655440000',
        'text/plain',
        300,
      );
      const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
      expect(() => verifyUploadToken(secret, tampered)).toThrow('Invalid upload token');
    });

    it('rejects a token signed with the wrong secret', () => {
      const token = createUploadToken(
        'wrong-secret-1234567',
        '550e8400-e29b-41d4-a716-446655440000',
        'text/plain',
        300,
      );
      expect(() => verifyUploadToken(secret, token)).toThrow('Invalid upload token');
    });

    it('rejects an expired token', () => {
      const token = createUploadToken(
        secret,
        '550e8400-e29b-41d4-a716-446655440000',
        'text/plain',
        -1,
      );
      expect(() => verifyUploadToken(secret, token)).toThrow('Upload token has expired');
    });

    it('rejects a token without a dot separator', () => {
      expect(() => verifyUploadToken(secret, 'nodot')).toThrow('Invalid upload token');
    });

    it('verifies a valid token', () => {
      const fileKey = '550e8400-e29b-41d4-a716-446655440000';
      const token = createUploadToken(secret, fileKey, 'application/pdf', 300);
      const result = verifyUploadToken(secret, token);
      expect(result.fileKey).toBe(fileKey);
      expect(result.contentType).toBe('application/pdf');
    });
  });
});
