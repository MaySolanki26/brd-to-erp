import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const storageDir = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: joinPath } = await import('node:path');
  return mkdtempSync(joinPath(tmpdir(), 'brd-storage-route-'));
});

vi.mock('../../config/env.js', async () => {
  const { envModule } = await import('../../test/test-env.js');
  return { env: { ...envModule.env, STORAGE_LOCAL_PATH: storageDir } };
});
vi.mock('../../lib/logger.js', async () => (await import('../../test/test-env.js')).loggerModule);
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { MAX_UPLOAD_BYTES } from '@brd/shared';
import { createApp } from '../../app.js';
import { createUploadToken } from '../../services/storage/storage-token.js';
import { storageService } from '../../services/storage/index.js';

const app = createApp({ rateLimit: false });
const SECRET = 'test-upload-secret-min-16';
const PDF = 'application/pdf';
const BODY = Buffer.from('%PDF-1.7 route test');

function tokenFor(fileKey: string, ttlSeconds = 300): string {
  return createUploadToken(SECRET, fileKey, PDF, ttlSeconds);
}

function upload(token: string | undefined, body: Buffer = BODY, method: 'post' | 'put' = 'post') {
  const path = token === undefined ? '/storage/upload' : `/storage/upload?token=${token}`;
  return request(app)[method](path).set('Content-Type', PDF).send(body);
}

describe('POST /storage/upload', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the bytes under the UUID key from a valid token', async () => {
    const { url, fileKey } = await storageService.createUploadUrl(PDF);
    const token = new URL(url).searchParams.get('token') ?? '';

    const res = await upload(encodeURIComponent(token));

    expect(res.status).toBe(201);
    expect(res.body.fileKey).toBe(fileKey);
    expect(readFileSync(join(storageDir, fileKey))).toEqual(BODY);
  });

  it('accepts the documented PUT verb as well', async () => {
    const fileKey = randomUUID();
    const res = await upload(tokenFor(fileKey), BODY, 'put');

    expect(res.status).toBe(201);
    expect(readFileSync(join(storageDir, fileKey))).toEqual(BODY);
  });

  it('rejects a missing token', async () => {
    const res = await upload(undefined);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed token', async () => {
    const res = await upload('not-a-token');
    expect(res.status).toBe(400);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = createUploadToken('another-secret-of-16-chars', randomUUID(), PDF, 300);
    const before = readdirSync(storageDir).length;

    const res = await upload(forged);

    expect(res.status).toBe(400);
    expect(readdirSync(storageDir)).toHaveLength(before);
  });

  it('rejects a token whose payload was altered', async () => {
    const [payload = '', signature = ''] = tokenFor(randomUUID()).split('.');
    const altered = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        fk: randomUUID(),
      }),
    ).toString('base64url');

    const res = await upload(`${altered}.${signature}`);

    expect(res.status).toBe(400);
  });

  it('rejects an expired token and writes nothing', async () => {
    const fileKey = randomUUID();
    const res = await upload(tokenFor(fileKey, -1));

    expect(res.status).toBe(400);
    expect(existsSync(join(storageDir, fileKey))).toBe(false);
  });

  it('rejects a validly signed token whose key tries to leave the storage directory', async () => {
    const escape = `../${randomUUID()}`;
    const res = await upload(tokenFor(escape));

    expect(res.status).toBe(400);
    expect(existsSync(join(storageDir, escape))).toBe(false);
  });

  it('rejects a validly signed token whose key is not a UUID', async () => {
    const res = await upload(tokenFor('not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const res = await upload(tokenFor(randomUUID()), Buffer.alloc(0));
    expect(res.status).toBe(400);
  });

  it('rejects a body over the size limit with 413 and writes nothing', async () => {
    const fileKey = randomUUID();
    const res = await upload(tokenFor(fileKey), Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1));

    expect(res.status).toBe(413);
    expect(existsSync(join(storageDir, fileKey))).toBe(false);
  });
});
