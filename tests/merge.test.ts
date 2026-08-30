import { describe, expect, it } from 'vitest';
import { applyConflictResolution, threeWayMerge } from '@aes/core';

describe('three-way memory merge', () => {
  it('auto-merges disjoint object changes', () => {
    expect(threeWayMerge({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({ status: 'merged', value: { a: 2, b: 3 }, conflicts: [] });
  });

  it('accepts identical changes', () => {
    expect(threeWayMerge({ state: 'draft' }, { state: 'done' }, { state: 'done' }).value).toEqual({ state: 'done' });
  });

  it.each([
    ['scalar', { value: 1 }, { value: 2 }, { value: 3 }, 'changed-both'],
    ['array', { value: [1] }, { value: [1, 2] }, { value: [1, 3] }, 'changed-both'],
    ['delete', { value: 1 }, {}, { value: 2 }, 'delete-vs-change'],
    ['restricted', { credentials: 'old' }, { credentials: 'left' }, { credentials: 'old' }, 'restricted-field'],
    ['balance', { wallet_balance: 2 }, { wallet_balance: 3 }, { wallet_balance: 2 }, 'restricted-field'],
  ])('requires resolution for %s conflicts', (_name, base, left, right, reason) => {
    const result = threeWayMerge(base, left, right);
    expect(result.status).toBe('conflict');
    expect(result.conflicts[0].reason).toBe(reason);
  });

  it('applies a complete manual resolution and rejects partial decisions', () => {
    const result = threeWayMerge({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 3, b: 2 });
    expect(() => applyConflictResolution(result.value, result.conflicts, {})).toThrow(/Every conflict/);
    expect(applyConflictResolution(result.value, result.conflicts, { a: { choice: 'left' } })).toEqual({ a: 2, b: 2 });
  });
});
