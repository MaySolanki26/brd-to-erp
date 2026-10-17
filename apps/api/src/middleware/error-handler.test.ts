import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);
vi.mock('../lib/logger.js', async () => (await import('../test/test-env.js')).loggerModule);

import { ConflictError } from '../errors/app-error.js';
import { errorHandler } from './error-handler.js';

function run(err: Error) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { locals: { requestId: 'r1' }, status } as unknown as Response;
  errorHandler(err, {} as Request, res, vi.fn());
  return { status, body: json.mock.calls[0]?.[0] as { error: { code: string; message: string } } };
}

describe('errorHandler', () => {
  it('keeps the status, code and message of application errors', () => {
    const { status, body } = run(new ConflictError('Already there'));
    expect(status).toHaveBeenCalledWith(409);
    expect(body.error).toMatchObject({ code: 'CONFLICT', message: 'Already there' });
  });

  it('answers a unique-constraint race as 409 without leaking the database message', () => {
    const err = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
      code: 'P2002',
    });
    const { status, body } = run(err);
    expect(status).toHaveBeenCalledWith(409);
    expect(body.error).toMatchObject({ code: 'CONFLICT', message: 'Already exists' });
  });

  it('answers 413 for a body that exceeds the parser limit', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413 });
    const { status, body } = run(err);
    expect(status).toHaveBeenCalledWith(413);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error.message).not.toMatch(/entity/);
  });

  it('answers other body-parser client errors as 400 without leaking the message', () => {
    const err = Object.assign(new Error('Unexpected token < in JSON'), { status: 400 });
    const { status, body } = run(err);
    expect(status).toHaveBeenCalledWith(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).not.toMatch(/token/);
  });

  it('hides unexpected errors behind a generic 500', () => {
    const { status, body } = run(new Error('secret internals'));
    expect(status).toHaveBeenCalledWith(500);
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('does not treat a 5xx status on a plain error as a client error', () => {
    const { status } = run(Object.assign(new Error('x'), { status: 503 }));
    expect(status).toHaveBeenCalledWith(500);
  });
});
