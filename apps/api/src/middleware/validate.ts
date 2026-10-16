import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../errors/app-error.js';

type Source = 'body' | 'query' | 'params';

export function validate<T extends z.ZodType>(schema: T, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(', ');
      next(new ValidationError(message));
      return;
    }
    // Express 5 exposes req.query as a getter, so redefine instead of assigning.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
