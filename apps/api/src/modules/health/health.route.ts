import { Router, type Router as RouterType } from 'express';
import { prisma } from '../../lib/prisma.js';

export const healthRouter: RouterType = Router();

healthRouter.get('/', async (_req, res) => {
  let dbStatus = 'up';

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    dbStatus = 'down';
  }

  const status = dbStatus === 'up' ? 'ok' : 'degraded';
  const httpStatus = dbStatus === 'up' ? 200 : 503;

  res.status(httpStatus).json({ status, db: dbStatus });
});
