import { z } from 'zod';
import type { AiUsage } from './ai-policy';

// A missing/malformed response must never appear to be an unused allowance.
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reset = z.iso.datetime({ offset: true });
const usageSchema = z.object({
  usedToday: count,
  usedThisMonth: count,
  dailyLimit: count,
  monthlyLimit: count,
  dailyResetAt: reset,
  monthlyResetAt: reset,
});

export function parseAiUsage(value: unknown): AiUsage {
  return z.object({ usage: usageSchema }).parse(value).usage;
}

export function allowanceMeter(used: number, limit: number) {
  return {
    remaining: Math.max(0, limit - used),
    percent: limit === 0 ? 100 : Math.min(100, (used / limit) * 100),
    exhausted: used >= limit,
  };
}

export type AllowanceState =
  | { status: 'loading' | 'signed-out' | 'error' | 'expired' }
  | { status: 'ready'; usage: AiUsage; checkedAt: string };
