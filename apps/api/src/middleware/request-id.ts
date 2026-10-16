import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();

  res.locals['requestId'] = id;
  res.setHeader('x-request-id', id);

  next();
}
