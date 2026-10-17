import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClientError, UploadCanceledError, apiClient } from './api-client';

interface ProgressEvent {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

class FakeXhr {
  static instances: FakeXhr[] = [];

  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  sent = false;
  status = 0;
  responseText = '';
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body: unknown): void {
    this.body = body;
    this.sent = true;
  }

  abort(): void {
    this.onabort?.();
  }

  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  respond(status: number, text = ''): void {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
const current = (): FakeXhr => FakeXhr.instances[FakeXhr.instances.length - 1] as FakeXhr;

describe('apiClient.upload', () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('posts the file to the absolute URL with its content type and no session cookie', async () => {
    const done = apiClient.upload('http://storage.test/upload?token=t', file, 'application/pdf');
    const xhr = current();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('http://storage.test/upload?token=t');
    expect(xhr.headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(xhr.body).toBe(file);
    expect(xhr).not.toHaveProperty('withCredentials');

    xhr.respond(201, '{}');
    await expect(done).resolves.toBeUndefined();
  });

  it('reports whole-number progress as bytes are sent', async () => {
    const onProgress = vi.fn();
    const done = apiClient.upload('http://s/u', file, 'application/pdf', { onProgress });
    current().progress(1, 3);
    current().progress(2, 3);
    current().progress(3, 3);
    current().respond(201);
    await done;
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual([33, 67, 100]);
  });

  it('ignores progress events without a known total', async () => {
    const onProgress = vi.fn();
    const done = apiClient.upload('http://s/u', file, 'application/pdf', { onProgress });
    current().upload.onprogress?.({ lengthComputable: false, loaded: 5, total: 0 });
    current().respond(201);
    await done;
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('turns an error envelope into an ApiClientError', async () => {
    const done = apiClient.upload('http://s/u', file, 'application/pdf');
    current().respond(
      413,
      JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large' } }),
    );
    await expect(done).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request is too large',
    });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    const done = apiClient.upload('http://s/u', file, 'application/pdf');
    current().respond(502, '<html>Bad gateway</html>');
    const error = await done.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 502, message: 'Upload failed. Please try again.' });
  });

  it('reports a friendly message when the network fails', async () => {
    const done = apiClient.upload('http://s/u', file, 'application/pdf');
    current().onerror?.();
    await expect(done).rejects.toThrow(/Check your connection/);
  });

  it('cancels the transfer when the signal aborts', async () => {
    const controller = new AbortController();
    const done = apiClient.upload('http://s/u', file, 'application/pdf', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(done).rejects.toBeInstanceOf(UploadCanceledError);
  });

  it('does not send anything when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiClient.upload('http://s/u', file, 'application/pdf', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadCanceledError);
    expect(FakeXhr.instances.some((x) => x.sent)).toBe(false);
  });
});
