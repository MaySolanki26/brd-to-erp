import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));

import { findUserByEmail, findUserById } from './auth.repository.js';

describe('auth.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'u1',
    email: 'test@example.com',
    name: 'Test',
    passwordHash: 'hash',
    organizationId: 'o1',
    deletedAt: null,
    role: { id: 'r1', name: 'ADMIN' },
  };

  describe('findUserByEmail', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      const result = await findUserByEmail('test@example.com');
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com', deletedAt: null },
        }),
      );
    });

    it('returns null when not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const result = await findUserByEmail('missing@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      const result = await findUserById('u1');
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const result = await findUserById('missing');
      expect(result).toBeNull();
    });
  });
});
