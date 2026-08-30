'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { CloudOff, LoaderCircle } from 'lucide-react';
import { getNeon, ensureAccountLimits } from '@/lib/neon';

type GateState = 'checking' | 'signed-in' | 'signed-out' | 'unconfigured';

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const e2eBypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_E2E_MODE === '1';
  const [state, setState] = useState<GateState>(
    e2eBypass ? 'signed-in' : 'checking',
  );

  useEffect(() => {
    if (e2eBypass) return;
    const neon = getNeon();
    if (!neon) {
      setState('unconfigured');
      return;
    }
    let active = true;
    const check = async () => {
      const result = (await neon.auth.getSession()) as any;
      const session = result?.data?.session ?? result?.data ?? result?.session;
      if (!active) return;
      if (!session?.user?.id) {
        setState('signed-out');
        return;
      }
      await ensureAccountLimits();
      if (active) setState('signed-in');
    };
    void check().catch(() => active && setState('signed-out'));
    const listener = neon.auth.onAuthStateChange?.(
      (_event: unknown, session: any) => {
        if (!active) return;
        if (session?.user?.id)
          void ensureAccountLimits().finally(
            () => active && setState('signed-in'),
          );
        else setState('signed-out');
      },
    ) as any;
    return () => {
      active = false;
      listener?.data?.subscription?.unsubscribe?.();
      listener?.subscription?.unsubscribe?.();
      listener?.unsubscribe?.();
    };
  }, [e2eBypass]);

  useEffect(() => {
    if (state !== 'signed-out') return;
    const next = pathname && pathname.startsWith('/') ? pathname : '/';
    window.location.replace(`/auth?next=${encodeURIComponent(next)}`);
  }, [pathname, state]);

  if (state === 'signed-in') return children;
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="paper w-full max-w-md rounded-[28px] p-7 text-center sm:p-9">
        <Image
          src="/brand/agent-evidence-logo.svg"
          alt="Agent Evidence Studio"
          width={220}
          height={43}
          unoptimized
          className="mx-auto h-10 w-auto max-w-[220px]"
        />
        <span className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-[#e9ffc1]">
          {state === 'unconfigured' ? (
            <CloudOff />
          ) : (
            <LoaderCircle className="animate-spin" />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">
          {state === 'unconfigured'
            ? 'Identity service needs setup'
            : 'Securing your workspace'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
          {state === 'unconfigured'
            ? 'The administrator must connect Neon Auth before members can use the workspace.'
            : 'Checking your Google session and private account limits…'}
        </p>
      </section>
    </main>
  );
}
