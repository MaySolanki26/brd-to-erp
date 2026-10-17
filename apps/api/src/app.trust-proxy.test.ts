import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/logger.js', async () => (await import('./test/test-env.js')).loggerModule);
vi.mock('./lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pino-http', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

async function appWithHops(hops: number) {
  vi.resetModules();
  vi.doMock('./config/env.js', async () => {
    const { envModule } = await import('./test/test-env.js');
    return { env: { ...envModule.env, TRUST_PROXY_HOPS: hops } };
  });
  const { createApp } = await import('./app.js');
  return createApp({ rateLimit: false });
}

describe('trust proxy', () => {
  afterEach(() => {
    vi.doUnmock('./config/env.js');
  });

  it('trusts no forwarded headers by default', async () => {
    const app = await appWithHops(0);
    expect(app.get('trust proxy')).toBeFalsy();
  });

  it('trusts exactly the configured number of proxies, never everything', async () => {
    const app = await appWithHops(1);
    expect(app.get('trust proxy')).toBe(1);
  });
});
