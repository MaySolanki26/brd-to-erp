import { config } from 'dotenv';
import { z } from 'zod';
import { isInsideRepo } from '../lib/repo-path.js';

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
    // Number of reverse proxies in front of the API. 0 trusts no forwarded headers.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    // Storage
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().optional(),
    STORAGE_UPLOAD_TOKEN_SECRET: z
      .string()
      .min(16, 'STORAGE_UPLOAD_TOKEN_SECRET must be at least 16 characters'),
    STORAGE_UPLOAD_TOKEN_TTL_SECONDS: z.coerce.number().default(300),

    // LLM. Defaults to recorded fixtures so nothing leaves the machine unless "real" is chosen.
    LLM_DRIVER: z.enum(['real', 'fixture']).default('fixture'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
    LLM_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(32000).default(4096),
    LLM_PROJECT_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().positive().default(2_000_000),
    LLM_RECORD_FIXTURES: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),

    // Auth / JWT
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
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
    if (data.STORAGE_DRIVER === 'local' && data.STORAGE_LOCAL_PATH) {
      if (isInsideRepo(data.STORAGE_LOCAL_PATH, process.cwd())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'STORAGE_LOCAL_PATH must be outside the repository',
          path: ['STORAGE_LOCAL_PATH'],
        });
      }
    }
    if (data.LLM_DRIVER === 'real' && !data.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ANTHROPIC_API_KEY is required when LLM_DRIVER is "real"',
        path: ['ANTHROPIC_API_KEY'],
      });
    }
    if (data.LLM_RECORD_FIXTURES && data.LLM_DRIVER !== 'real') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LLM_RECORD_FIXTURES only applies when LLM_DRIVER is "real"',
        path: ['LLM_RECORD_FIXTURES'],
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
