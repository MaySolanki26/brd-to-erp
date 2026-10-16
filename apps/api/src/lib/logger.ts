import pino from 'pino';
import { env } from '../config/env.js';

const transport =
  env.APP_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true },
      }
    : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
});
