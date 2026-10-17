import { describe, expect, it } from 'vitest';
import { ServiceUnavailableError } from '../../errors/app-error.js';
import { S3StorageService } from './s3-storage.service.js';

describe('S3StorageService', () => {
  const storage = new S3StorageService();

  it('fails every operation with a typed 503 until the driver exists', async () => {
    const calls = [
      storage.createUploadUrl('application/pdf'),
      storage.confirmUpload('key'),
      storage.getDownloadStream('key'),
      storage.delete('key'),
    ];
    for (const call of calls) {
      await expect(call).rejects.toBeInstanceOf(ServiceUnavailableError);
      await expect(call).rejects.toMatchObject({ statusCode: 503 });
    }
  });
});
