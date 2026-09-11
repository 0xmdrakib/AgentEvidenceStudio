'use client';
import { useEffect, useState } from 'react';
import { AI_LIMITS, type AiUsage } from '@/lib/ai-policy';
import {
  getCurrentNeonUser,
  getNeonSession,
  subscribeToNeonSignOut,
} from '@/lib/neon';

export function AiAllowance({ refreshKey = 0 }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [status, setStatus] = useState(
    'Sign in to see your remaining research allowance.',
  );
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToNeonSignOut(() => {
      active = false;
      setUsage(null);
      setStatus('Sign in to see your remaining research allowance.');
    });
    void (async () => {
      if (!(await getCurrentNeonUser())) return;
      if (active) setStatus('Checking research allowance…');
      const { accessToken } = await getNeonSession();
      const response = await fetch('/api/runner?usage=1', {
        cache: 'no-store',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Allowance temporarily unavailable.');
      const data = (await response.json()) as { usage: AiUsage };
      if (active) {
        setUsage(data.usage);
        setStatus('');
      }
    })().catch(() => {
      if (active)
        setStatus(
          'Your allowance could not be loaded. Starting research will check it again.',
        );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshKey]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#fcf9f3] p-4 text-sm">
      <p className="font-extrabold">Research allowance</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <strong>
            {usage
              ? Math.max(0, usage.dailyLimit - usage.usedToday)
              : AI_LIMITS.dailyRuns}
          </strong>
          <span className="text-[var(--muted-ink)]">
            {' '}
            {usage ? 'remaining today' : 'runs per day'}
          </span>
        </div>
        <div>
          <strong>
            {usage
              ? Math.max(0, usage.monthlyLimit - usage.usedThisMonth)
              : AI_LIMITS.monthlyRuns}
          </strong>
          <span className="text-[var(--muted-ink)]">
            {' '}
            {usage ? 'remaining this month' : 'runs per month'}
          </span>
        </div>
      </div>
      {status && (
        <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
          {status}
        </p>
      )}
      <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
        One research at a time. Allowances reset at 00:00 UTC, daily and on the
        first of each month. Submitted attempts count, including interrupted or
        failed runs. Availability also depends on the shared site allowance.
      </p>
    </div>
  );
}
