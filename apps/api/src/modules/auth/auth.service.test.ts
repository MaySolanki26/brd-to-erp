import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-min-16',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-16',
    JWT_ACCESS_EXPIRY_SECONDS: 900,
    JWT_REFRESH_EXPIRY_SECONDS: 604800,
  },
}));

const mockRepo = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('./auth.repository.js', () => mockRepo);

import { login, getMe } from './auth.service.js';

const mockUser = {
  id: 'u1',
  email: 'admin@brd.local',
  name: 'Admin',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
  organizationId: 'o1',
  deletedAt: null,
  role: { id: 'r1', name: 'ADMIN' },
};

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('throws for unknown email', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(null);
      await expect(login('bad@email.com', 'pass')).rejects.toThrow('Invalid email or password');
    });

    it('throws for wrong password', async () => {
      mockRepo.findUserByEmail.mockResolvedValue(mockUser);
      await expect(login('admin@brd.local', 'wrong')).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getMe', () => {
    it('returns user DTO when found', async () => {
      mockRepo.findUserById.mockResolvedValue(mockUser);
      const result = await getMe('u1');
      expect(result).toEqual({
        id: 'u1',
        email: 'admin@brd.local',
        name: 'Admin',
        organizationId: 'o1',
        role: { id: 'r1', name: 'ADMIN' },
      });
    });

    it('throws when user not found', async () => {
      mockRepo.findUserById.mockResolvedValue(null);
      await expect(getMe('missing')).rejects.toThrow('User not found');
    });
  });
});
