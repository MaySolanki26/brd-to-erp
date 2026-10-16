import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const appEnv = process.env.APP_ENV ?? 'development';
config({ path: `.env.${appEnv}` }); // real env vars (server/CI) are not overridden

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
