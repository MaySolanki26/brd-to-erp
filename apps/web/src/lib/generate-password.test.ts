import { describe, it, expect } from 'vitest';
import { generatePassword } from './generate-password';

describe('generatePassword', () => {
  it('produces the requested length from an unambiguous alphabet', () => {
    const password = generatePassword(24);
    expect(password).toHaveLength(24);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });

  it('meets the 12 character minimum by default and is not repeated', () => {
    const first = generatePassword();
    expect(first.length).toBeGreaterThanOrEqual(12);
    expect(generatePassword()).not.toBe(first);
  });
});
