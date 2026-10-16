import { describe, it, expect } from 'vitest';
import { generateOpaqueToken, hashToken } from './tokens.js';

describe('tokens', () => {
  it('generates unique url-safe tokens with 256 bits of entropy', () => {
    const a = generateOpaqueToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateOpaqueToken()).not.toBe(a);
  });

  it('hashes deterministically and never returns the input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe('abc');
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});
