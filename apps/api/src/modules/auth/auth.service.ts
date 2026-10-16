import bcrypt from 'bcryptjs';
import type { UserDto } from '@brd/shared';
import { UnauthorizedError } from '../../errors/app-error.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { findUserByEmail, findUserById, type UserWithRole } from './auth.repository.js';

function toUserDto(user: UserWithRole): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    role: user.role,
  };
}

interface AuthTokens {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ userId: user.id, organizationId: user.organizationId, roleName: user.role.name }),
    signRefreshToken({ userId: user.id }),
  ]);

  return { user: toUserDto(user), accessToken, refreshToken };
}

export async function refresh(token: string): Promise<AuthTokens> {
  const { userId } = await verifyRefreshToken(token);

  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ userId: user.id, organizationId: user.organizationId, roleName: user.role.name }),
    signRefreshToken({ userId: user.id }),
  ]);

  return { user: toUserDto(user), accessToken, refreshToken };
}

export async function getMe(userId: string): Promise<UserDto> {
  const user = await findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return toUserDto(user);
}
