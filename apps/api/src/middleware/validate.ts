import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../errors/app-error.js';

export function validate<T extends z.ZodType>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(', ');
      next(new ValidationError(message));
      return;
    }
    // Replace with parsed/typed data
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
