import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { validate } from './validate.js';

function run(source: 'body' | 'query' | 'params', schema: z.ZodType, value: unknown) {
  const req = { [source]: value } as unknown as Request;
  const next = vi.fn();
  validate(schema, source)(req, {} as Response, next);
  return { req, next };
}

describe('validate', () => {
  it('replaces the body with the parsed, coerced value', () => {
    const { req, next } = run('body', z.object({ n: z.coerce.number() }), { n: '5', extra: 1 });
    expect(req.body).toEqual({ n: 5 });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a ValidationError with all issue messages', () => {
    const { next } = run('body', z.object({ a: z.string(), b: z.string() }), {});
    const err = next.mock.calls[0]?.[0] as Error & { statusCode: number };
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('expected string');
  });

  it('can replace a getter-only query property (Express 5)', () => {
    const req = {} as Request;
    Object.defineProperty(req, 'query', { get: () => ({ page: '2' }), configurable: true });
    validate(z.object({ page: z.coerce.number() }), 'query')(req, {} as Response, vi.fn());
    expect(req.query).toEqual({ page: 2 });
  });
});
