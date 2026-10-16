import argon2 from 'argon2';

// OWASP-recommended argon2id minimum: 19 MiB memory, 2 iterations, 1 lane.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must behave like a wrong password, not a 500.
    return false;
  }
}

/** Burns the same CPU as a real verification so unknown emails are not distinguishable by timing. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalisation');
  await verifyPassword(await dummyHash, password);
}
