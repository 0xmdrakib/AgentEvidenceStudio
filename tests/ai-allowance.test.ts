import { describe, expect, it } from 'vitest';
import { allowanceMeter, parseAiUsage } from '../lib/ai-allowance';

const usage = {
  usedToday: 1,
  usedThisMonth: 4,
  dailyLimit: 2,
  monthlyLimit: 10,
  dailyResetAt: '2026-09-13T00:00:00+00:00',
  monthlyResetAt: '2026-10-01T00:00:00+00:00',
};

describe('account research usage', () => {
  it('reads the database response and preserves both actual counters and reset times', () => {
    expect(parseAiUsage({ usage })).toEqual(usage);
  });
  it('distinguishes a verified zero from unavailable data', () => {
    expect(parseAiUsage({ usage: { ...usage, usedToday: 0 } }).usedToday).toBe(
      0,
    );
    for (const value of [
      null,
      {},
      { usage: null },
      { usage: { dailyLimit: 2 } },
    ])
      expect(() => parseAiUsage(value)).toThrow();
  });
  it('rejects malformed, negative, fractional, and nonfinite counters', () => {
    for (const key of [
      'usedToday',
      'usedThisMonth',
      'dailyLimit',
      'monthlyLimit',
    ]) {
      for (const value of [
        -1,
        0.5,
        Infinity,
        NaN,
        '1',
        null,
        Number.MAX_SAFE_INTEGER + 1,
      ])
        expect(() =>
          parseAiUsage({ usage: { ...usage, [key]: value } }),
        ).toThrow();
    }
  });
  it('requires valid, timezone-qualified reset times', () => {
    for (const value of [
      'soon',
      '',
      '2026-09-13T00:00:00',
      '2026-02-31T00:00:00Z',
    ])
      expect(() =>
        parseAiUsage({ usage: { ...usage, dailyResetAt: value } }),
      ).toThrow();
  });
  it.each([
    [0, 2, 2, 0, false],
    [1, 2, 1, 50, false],
    [4, 10, 6, 40, false],
    [2, 2, 0, 100, true],
    [12, 10, 0, 100, true],
    [0, 0, 0, 100, true],
  ])(
    'calculates used=%i / limit=%i without negative remaining or overflowing bars',
    (used, limit, remaining, percent, exhausted) => {
      expect(allowanceMeter(used, limit)).toEqual({
        remaining,
        percent,
        exhausted,
      });
    },
  );
});
