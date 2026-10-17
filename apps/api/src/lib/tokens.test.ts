import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/env.js', async () => (await import('../test/test-env.js')).envModule);

import { generateOpaqueToken, hashEmailForAudit, hashToken } from './tokens.js';

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

  it('hashes emails with a key, ignoring case and surrounding spaces', () => {
    expect(hashEmailForAudit(' Ann@Example.com ')).toBe(hashEmailForAudit('ann@example.com'));
    expect(hashEmailForAudit('ann@example.com')).not.toBe(hashToken('ann@example.com'));
    expect(hashEmailForAudit('ann@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });
});
