import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { clearUserStorage, defineStorageItem } from './storage';

const density = (userId: string) =>
  defineStorageItem({
    name: 'density',
    version: 1,
    scope: { userId },
    schema: z.enum(['compact', 'comfortable']),
    defaultValue: 'comfortable',
  });

describe('storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a value under a namespaced, versioned key', () => {
    density('u1').set('compact');
    expect(density('u1').get()).toBe('compact');
    expect(window.localStorage.getItem('brd:user:u1:density:v1')).toBe('"compact"');
  });

  it('returns the default and removes the key for invalid JSON', () => {
    window.localStorage.setItem('brd:user:u1:density:v1', '{broken');
    expect(density('u1').get()).toBe('comfortable');
    expect(window.localStorage.getItem('brd:user:u1:density:v1')).toBeNull();
  });

  it('returns the default and removes the key when the shape is wrong', () => {
    window.localStorage.setItem('brd:user:u1:density:v1', '"huge"');
    expect(density('u1').get()).toBe('comfortable');
    expect(window.localStorage.getItem('brd:user:u1:density:v1')).toBeNull();
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(density('u1').get()).toBe('comfortable');
    expect(() => density('u1').set('compact')).not.toThrow();
  });

  it("clears only the given user's keys on sign-out", () => {
    density('u1').set('compact');
    density('u2').set('compact');
    window.localStorage.setItem('brd:app:theme:v1', '"dark"');

    clearUserStorage('u1');

    expect(window.localStorage.getItem('brd:user:u1:density:v1')).toBeNull();
    expect(window.localStorage.getItem('brd:user:u2:density:v1')).not.toBeNull();
    expect(window.localStorage.getItem('brd:app:theme:v1')).not.toBeNull();
  });
});
