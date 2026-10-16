import { describe, it, expect } from 'vitest';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes with argon2id and verifies the right password only', async () => {
    const hash = await hashPassword('s3cret-value');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 's3cret-value')).toBe(true);
    expect(await verifyPassword(hash, 'other')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('treats a malformed stored hash as a mismatch instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });

  it('runs the dummy verification without throwing', async () => {
    await expect(verifyAgainstDummy('anything')).resolves.toBeUndefined();
  });
});
