import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-min-16',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-16',
    JWT_ACCESS_EXPIRY_SECONDS: 900,
    JWT_REFRESH_EXPIRY_SECONDS: 604800,
  },
}));

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';

describe('JWT helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('access token', () => {
    const payload = { userId: 'u1', organizationId: 'o1', roleName: 'ADMIN' };

    it('signs and verifies a valid access token', async () => {
      const token = await signAccessToken(payload);
      const result = await verifyAccessToken(token);

      expect(result.userId).toBe('u1');
      expect(result.organizationId).toBe('o1');
      expect(result.roleName).toBe('ADMIN');
    });

    it('rejects a tampered token', async () => {
      const token = await signAccessToken(payload);
      const parts = token.split('.');
      // Corrupt the signature by reversing it
      parts[2] = parts[2]!.split('').reverse().join('');
      const tampered = parts.join('.');
      await expect(verifyAccessToken(tampered)).rejects.toThrow('Invalid access token');
    });
  });

  describe('refresh token', () => {
    const payload = { userId: 'u1' };

    it('signs and verifies a valid refresh token', async () => {
      const token = await signRefreshToken(payload);
      const result = await verifyRefreshToken(token);

      expect(result.userId).toBe('u1');
    });

    it('rejects an access token used as refresh token', async () => {
      const accessToken = await signAccessToken({ userId: 'u1', organizationId: 'o1', roleName: 'ADMIN' });
      await expect(verifyRefreshToken(accessToken)).rejects.toThrow('Invalid refresh token');
    });
  });
});
