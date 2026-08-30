'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  LockKeyhole,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentNeonUser, getNeon, signInWithGoogle } from '@/lib/neon';

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 place-items-center rounded-full bg-white shadow-sm"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.31.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.53l3.35-2.61Z" />
        <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" />
      </svg>
    </span>
  );
}

export default function AuthPage() {
  const searchParams = useSearchParams();
  const neon = getNeon();
  const next = useMemo(() => {
    const candidate = searchParams.get('next') ?? '/';
    return candidate.startsWith('/') && !candidate.startsWith('//')
      ? candidate
      : '/';
  }, [searchParams]);
  const [user, setUser] = useState<{
    email: string | null;
    name: string | null;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    searchParams.get('error')
      ? 'Google sign-in could not be completed. Please try again.'
      : '',
  );

  useEffect(() => {
    void getCurrentNeonUser()
      .then((current) =>
        setUser(current ? { email: current.email, name: current.name } : null),
      )
      .finally(() => setChecking(false));
  }, []);

  const signIn = async () => {
    setBusy(true);
    setMessage('');
    try {
      await signInWithGoogle(next);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Google sign-in failed.',
      );
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!neon) return;
    setBusy(true);
    await neon.auth.signOut();
    setUser(null);
    setBusy(false);
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <section className="paper grid w-full max-w-4xl overflow-hidden rounded-[30px] lg:grid-cols-[1.05fr_.95fr]">
        <div className="bg-[var(--ink)] p-6 text-[#fffaf0] sm:p-9">
          <Link
            href="/"
            className="inline-flex"
            aria-label="Agent Evidence Studio home"
          >
            <Image
              src="/brand/agent-evidence-logo.svg"
              alt=""
              aria-hidden="true"
              width={220}
              height={43}
              unoptimized
              className="h-10 w-auto max-w-[220px] brightness-0 invert"
            />
          </Link>
          <span className="mt-12 grid h-14 w-14 place-items-center rounded-2xl bg-[#c8ff65] text-[var(--ink)]">
            <Cloud />
          </span>
          <p className="eyebrow mt-7 text-white/55">One secure account</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            Your evidence stays yours.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/68">
            Browse the studio freely. Sign in with Google only when you use
            hosted execution, save encrypted history, or publish a report.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/78">
            <li className="flex items-center gap-3">
              <LockKeyhole className="text-[#c8ff65]" size={18} />
              10 MB hard encrypted-history quota
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-[#c8ff65]" size={18} />
              No password stored by this app
            </li>
          </ul>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-9">
          <p className="eyebrow text-[var(--muted-ink)]">Member access</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
            Continue with Google
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
            Your Google identity becomes the permanent owner key for quota,
            encrypted history, and hosted activity limits.
          </p>
          {!neon ? (
            <div className="mt-7 rounded-2xl border border-[#e5c66f] bg-[#fff8df] p-4 text-sm leading-6">
              Google sign-in is waiting for the administrator to finish Neon
              Auth configuration.
            </div>
          ) : checking ? (
            <div className="mt-7 h-12 animate-pulse rounded-xl bg-[var(--muted)]" />
          ) : user ? (
            <div className="mt-7 rounded-2xl border bg-[#edf7f3] p-4">
              <p className="font-extrabold">Signed in</p>
              <p className="mt-1 text-sm text-[var(--muted-ink)]">
                {user.name ?? user.email ?? 'Google account'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  nativeButton={false}
                  render={<Link href={next} />}
                  className="min-h-11 rounded-xl bg-[var(--ink)] !text-white"
                >
                  Open workspace <ArrowRight />
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-xl bg-white"
                  disabled={busy}
                  onClick={signOut}
                >
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="mt-7 min-h-13 w-full justify-center rounded-2xl bg-white text-[var(--ink)] shadow-[0_10px_28px_rgb(16_35_30/12%)] ring-1 ring-[var(--line)] hover:bg-[#f8f4ec]"
              disabled={busy}
              onClick={signIn}
            >
              <GoogleMark />
              {busy ? 'Opening Google…' : 'Continue with Google'}
            </Button>
          )}
          {message && (
            <output className="mt-4 block rounded-xl bg-[#fff0ed] p-3 text-sm text-[#8d2e27]">
              {message}
            </output>
          )}
          <p className="mt-7 text-xs leading-5 text-[var(--muted-ink)]">
            By continuing, you agree to the{' '}
            <Link
              href="/terms"
              className="font-bold underline underline-offset-4"
            >
              Terms
            </Link>{' '}
            and acknowledge the{' '}
            <Link
              href="/privacy"
              className="font-bold underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
