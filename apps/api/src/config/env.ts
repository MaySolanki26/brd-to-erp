import { config } from 'dotenv';
import { z } from 'zod';

const appEnv = process.env['APP_ENV'] ?? 'development';
config({ path: `.env.${appEnv}`, override: false });

const envSchema = z
  .object({
    APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Storage
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().optional(),
    STORAGE_UPLOAD_TOKEN_SECRET: z.string().min(16, 'STORAGE_UPLOAD_TOKEN_SECRET must be at least 16 characters'),
    STORAGE_UPLOAD_TOKEN_TTL_SECONDS: z.coerce.number().default(300),

    // Auth / JWT
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
    JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().default(900),
    JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().default(604800),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER === 'local' && !data.STORAGE_LOCAL_PATH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STORAGE_LOCAL_PATH is required when STORAGE_DRIVER is "local"',
        path: ['STORAGE_LOCAL_PATH'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
