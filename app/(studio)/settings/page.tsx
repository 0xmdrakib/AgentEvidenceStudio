'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HardDrive, LogIn, LogOut, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/page-heading';
import {
  DEFAULT_ACCOUNT_LIMITS,
  getAccountUsage,
  getCurrentNeonUser,
  getNeon,
} from '@/lib/neon';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        eyebrow="Account"
        title="Workspace settings"
        description="Manage your Google account, private storage quota, and sign-out controls."
      />
      <AccountSection />
    </div>
  );
}

function AccountSection() {
  const configured = Boolean(getNeon());
  const [user, setUser] =
    useState<Awaited<ReturnType<typeof getCurrentNeonUser>>>(null);
  const [usage, setUsage] = useState<Awaited<
    ReturnType<typeof getAccountUsage>
  > | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    void getCurrentNeonUser()
      .then(async (currentUser) => {
        setUser(currentUser);
        setUsage(currentUser ? await getAccountUsage() : null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [configured]);

  const used = usage?.storage_used_bytes ?? 0;
  const limit = usage?.storage_limit_bytes ?? 10 * 1024 * 1024;
  const percentage = Math.min(
    100,
    Math.round((used / Math.max(limit, 1)) * 100),
  );
  const signOut = async () => {
    await getNeon()?.auth.signOut();
    window.location.assign('/');
  };

  return (
    <section className="paper overflow-hidden rounded-[26px]">
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9ffc1]">
                <UserRound size={21} />
              </span>
              <div className="min-w-0">
                <p className="eyebrow text-[var(--muted-ink)]">
                  Google account
                </p>
                <h2 className="mt-1 truncate text-xl font-extrabold">
                  {user?.name ??
                    user?.email ??
                    (loading ? 'Checking account…' : 'Not signed in')}
                </h2>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${user ? 'bg-[#dcefea] text-[#225f4d]' : 'bg-[#fff0bd] text-[#6d5518]'}`}
            >
              {user
                ? 'Signed in'
                : configured
                  ? 'Login to save'
                  : 'Unavailable'}
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--muted-ink)]">
            Browse the studio without an account. Login is required only when
            an action uses hosted execution, cloud storage, or publishing.
          </p>
          {configured && user && (
            <Button
              variant="outline"
              className="mt-5 min-h-11 rounded-xl bg-white"
              onClick={signOut}
            >
              <LogOut />
              Sign out
            </Button>
          )}
          {configured && !loading && !user && (
            <Button
              nativeButton={false}
              render={<Link href="/auth?next=/settings" />}
              className="mt-5 min-h-11 rounded-xl bg-[var(--ink)] !text-white"
            >
              <LogIn />
              Login with Google
            </Button>
          )}
        </div>

        <div className="border-t bg-[#f5f0e8] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white">
                <HardDrive size={20} />
              </span>
              <div>
                <p className="eyebrow text-[var(--muted-ink)]">Storage</p>
                <h3 className="mt-1 font-extrabold">10 MB member plan</h3>
              </div>
            </div>
            <strong className="text-sm">{percentage}%</strong>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--teal)] transition-[width]"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-[var(--muted-ink)]">
            <span>{formatBytes(used)} used</span>
            <span>{formatBytes(limit)} total</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <QuotaStat
              label="Encrypted versions"
              value={
                user
                  ? `${usage?.bundle_versions ?? 0} / ${usage?.version_limit ?? DEFAULT_ACCOUNT_LIMITS.versions}`
                  : `${DEFAULT_ACCOUNT_LIMITS.versions} max`
              }
            />
            <QuotaStat
              label="Max version size"
              value={formatBytes(DEFAULT_ACCOUNT_LIMITS.bundleBytes)}
            />
            <QuotaStat
              label="Published reports"
              value={
                user
                  ? `${usage?.published_reports ?? 0} / ${usage?.report_limit ?? DEFAULT_ACCOUNT_LIMITS.reports}`
                  : `${DEFAULT_ACCOUNT_LIMITS.reports} max`
              }
            />
            <QuotaStat
              label="Max report size"
              value={formatBytes(DEFAULT_ACCOUNT_LIMITS.reportBytes)}
            />
            <QuotaStat
              label="Cloud writes"
              value={
                user
                  ? `${usage?.cloud_writes_today ?? 0} / ${usage?.daily_cloud_write_limit ?? DEFAULT_ACCOUNT_LIMITS.dailyCloudWrites} today`
                  : `${DEFAULT_ACCOUNT_LIMITS.dailyCloudWrites} / day`
              }
            />
            <QuotaStat
              label="Hosted runs"
              value={
                user
                  ? `${usage?.hosted_runs_today ?? 0} / ${usage?.daily_hosted_run_limit ?? DEFAULT_ACCOUNT_LIMITS.dailyHostedRuns} today`
                  : `${DEFAULT_ACCOUNT_LIMITS.dailyHostedRuns} / day`
              }
            />
          </div>
          {!user && (
            <p className="mt-5 rounded-2xl border bg-white p-3 text-xs leading-5 text-[var(--muted-ink)]">
              Login to replace plan limits with your live account usage.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function QuotaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <p className="text-[11px] font-bold text-[var(--muted-ink)]">{label}</p>
      <p className="mt-1 text-lg font-black tracking-tight">{value}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
