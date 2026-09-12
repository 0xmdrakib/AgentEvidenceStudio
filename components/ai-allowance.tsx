'use client';
import { useEffect, useId, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AI_LIMITS } from '@/lib/ai-policy';
import {
  allowanceMeter,
  parseAiUsage,
  type AllowanceState,
} from '@/lib/ai-allowance';
import {
  getCurrentNeonUser,
  getNeonSession,
  isNeonSignInRequiredError,
  redirectToGoogleSignIn,
  subscribeToNeonSignOut,
} from '@/lib/neon';

export function AiAllowance({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<AllowanceState>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let sequence = 0;
    let lastAttempt = 0;
    let controller: AbortController | undefined;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const request = ++sequence;
      lastAttempt = Date.now();
      controller?.abort();
      clearTimeout(resetTimer);
      controller = new AbortController();
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(20_000),
      ]);
      const current = () => !disposed && sequence === request;
      setState({ status: 'loading' });
      let phase = 'account';
      let httpStatus: number | undefined;
      try {
        const user = await getCurrentNeonUser();
        if (!current()) return;
        if (!user) {
          setState({ status: 'signed-out' });
          return;
        }
        phase = 'session';
        const { accessToken, userId } = await getNeonSession();
        if (!current()) return;
        if (userId !== user.id) throw new Error('Account changed.');
        phase = 'usage-request';
        const response = await fetch('/api/runner?usage=1', {
          cache: 'no-store',
          headers: { authorization: `Bearer ${accessToken}` },
          signal,
        });
        httpStatus = response.status;
        if (!current()) return;
        if (response.status === 401) {
          setState({ status: 'expired' });
          return;
        }
        if (!response.ok) throw new Error('Allowance unavailable.');
        phase = 'usage-response';
        const usage = parseAiUsage(await response.json());
        if (!current()) return;
        setState({
          status: 'ready',
          usage,
          checkedAt: new Date().toISOString(),
        });
        // One refresh at the next UTC reset, not continuous background polling.
        const nextReset = Math.min(
          Date.parse(usage.dailyResetAt),
          Date.parse(usage.monthlyResetAt),
        );
        if (nextReset > Date.now()) {
          resetTimer = setTimeout(
            () => {
              if (document.visibilityState === 'visible') void load();
            },
            Math.min(2_147_483_647, nextReset - Date.now() + 1_000),
          );
        }
      } catch (error) {
        if (current()) {
          // Diagnostic metadata only: never log tokens, user IDs, or bodies.
          console.warn('Research allowance check failed.', {
            phase,
            httpStatus,
          });
          setState({
            status: isNeonSignInRequiredError(error) ? 'expired' : 'error',
          });
        }
      }
    };
    const refreshWhenVisible = () => {
      // Refresh after another tab/run, without a request on every focus event.
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastAttempt > 30_000
      )
        void load();
    };
    const unsubscribe = subscribeToNeonSignOut(() => {
      sequence++;
      controller?.abort();
      clearTimeout(resetTimer);
      setState({ status: 'signed-out' });
    });
    void load();
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(resetTimer);
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshKey, retryKey]);

  return (
    <AiAllowanceView
      state={state}
      onRefresh={() => setRetryKey((value) => value + 1)}
      onSignIn={() => redirectToGoogleSignIn()}
    />
  );
}

export function AiAllowanceView({
  state,
  onRefresh,
  onSignIn,
}: {
  state: AllowanceState;
  onRefresh: () => void;
  onSignIn: () => void;
}) {
  const headingId = useId();
  const usage = state.status === 'ready' ? state.usage : null;
  const unavailable = state.status === 'error';
  const needsSignIn =
    state.status === 'signed-out' || state.status === 'expired';
  const statusText = {
    loading: 'Checking your research usage…',
    'signed-out': 'Sign in to see your used and remaining runs.',
    expired: 'Your session has expired. Sign in again to see your usage.',
    error: 'Usage is temporarily unavailable. Retry to check your allowance.',
    ready: '',
  }[state.status];

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-[var(--line)] bg-[#fcf9f3] p-4 text-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <h3 id={headingId} className="font-extrabold">
            Research allowance
          </h3>
          <p className="mt-1 text-xs text-[var(--muted-ink)]">
            Your account’s research runs
          </p>
        </div>
        {!needsSignIn && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 gap-2"
            onClick={onRefresh}
            disabled={state.status === 'loading'}
            aria-label={
              unavailable ? 'Retry research usage' : 'Refresh research usage'
            }
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={
                state.status === 'loading' ? 'motion-safe:animate-spin' : ''
              }
            />
            {state.status === 'loading'
              ? 'Checking'
              : unavailable
                ? 'Retry'
                : 'Refresh'}
          </Button>
        )}
      </div>
      <div
        className="mt-4 grid gap-3 sm:grid-cols-2"
        aria-busy={state.status === 'loading'}
      >
        <AllowancePeriod
          label="Today"
          used={usage?.usedToday}
          limit={usage?.dailyLimit ?? AI_LIMITS.dailyRuns}
          resetAt={usage?.dailyResetAt}
        />
        <AllowancePeriod
          label="This month"
          used={usage?.usedThisMonth}
          limit={usage?.monthlyLimit ?? AI_LIMITS.monthlyRuns}
          resetAt={usage?.monthlyResetAt}
        />
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {statusText && (
          <p className="mt-3 leading-6 text-[var(--muted-ink)]">{statusText}</p>
        )}
        {usage && (
          <span className="sr-only">
            {usage.usedToday} of {usage.dailyLimit} runs used today;{' '}
            {usage.usedThisMonth} of {usage.monthlyLimit} used this month.
          </span>
        )}
      </div>
      {needsSignIn && (
        <Button
          type="button"
          variant="outline"
          className="mt-2 min-h-11"
          onClick={onSignIn}
        >
          Sign in to view usage
        </Button>
      )}
      <div className="mt-4 border-t border-[var(--line)] pt-3">
        <p className="text-xs leading-5 text-[var(--muted-ink)]">
          One research at a time. Submitted attempts count, including
          interrupted or failed runs. Daily allowance resets at 00:00 UTC;
          monthly allowance resets on the first of the month. Shared site limits
          also apply.
        </p>
        {state.status === 'ready' && (
          <p className="mt-2 text-xs text-[var(--muted-ink)]">
            Updated{' '}
            {new Date(state.checkedAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Refreshing usage does not use a run.
          </p>
        )}
      </div>
    </section>
  );
}

function AllowancePeriod({
  label,
  used,
  limit,
  resetAt,
}: {
  label: string;
  used?: number;
  limit: number;
  resetAt?: string;
}) {
  const meter = used === undefined ? null : allowanceMeter(used, limit);
  const resetLabel = resetAt
    ? new Date(resetAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : null;
  return (
    <div
      className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4"
      role="group"
      aria-label={`${label} research usage`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{label}</p>
        {meter && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-bold ${meter.exhausted ? 'bg-[#fff0c2] text-[#754b0a]' : 'bg-[#e8f1ee] text-[var(--teal)]'}`}
          >
            {meter.exhausted ? 'Limit reached' : `${meter.remaining} remaining`}
          </span>
        )}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <strong className="text-3xl font-black tracking-tight">
          {used ?? '—'}
        </strong>
        <span className="text-[var(--muted-ink)]">/ {limit} runs used</span>
      </p>
      {meter ? (
        <div
          role="meter"
          aria-label={`${label} allowance used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meter.percent}
          aria-valuetext={`${used} of ${limit} runs used; ${meter.remaining} remaining`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe5dc]"
        >
          <div
            className={`h-full rounded-full ${meter.exhausted ? 'bg-[#b47a1c]' : 'bg-[var(--teal)]'}`}
            style={{ width: `${meter.percent}%` }}
          />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="mt-3 h-1.5 rounded-full bg-[#ebe5dc]"
        />
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-[var(--muted-ink)]">
        <Clock3 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        {resetAt ? (
          <span>
            Resets <time dateTime={resetAt}>{resetLabel} UTC</time>
          </span>
        ) : (
          <span>Usage appears after a successful check.</span>
        )}
      </p>
    </div>
  );
}
