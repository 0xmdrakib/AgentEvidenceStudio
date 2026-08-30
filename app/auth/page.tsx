'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  LockKeyhole,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getNeon } from '@/lib/neon';

export default function AuthPage() {
  const neon = getNeon();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void neon?.auth
      .getUser()
      .then((result: any) =>
        setUserEmail(result?.data?.user?.email ?? result?.user?.email ?? null),
      );
  }, [neon]);
  const submit = async () => {
    if (!neon) return;
    setBusy(true);
    setMessage('');
    try {
      const result =
        mode === 'signup'
          ? await neon.auth.signUp({
              email,
              password,
              options: { data: { name } },
            })
          : await neon.auth.signInWithPassword({ email, password });
      const error = (result as any)?.error;
      if (error) throw error;
      setUserEmail(email);
      setMessage(
        mode === 'signup'
          ? 'Account created and private cloud unlocked.'
          : 'Signed in. Private cloud history is available.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="paper w-full max-w-md rounded-[28px] p-6 sm:p-8">
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft size={17} />
          Back to settings
        </Link>
        <span className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#c8ff65]">
          <Cloud />
        </span>
        <h1 className="display mt-5 text-4xl">Neon private cloud</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">
          Neon Auth protects owner-scoped metadata and immutable encrypted bundle
          versions. Your workspace passphrase and unwrapped key never leave your
          device.
        </p>
        {!neon ? (
          <div className="mt-6 rounded-2xl bg-[#fff0ed] p-4 text-sm leading-6">
            Neon Auth and Data API URLs are not connected yet. Complete the
            one-time Neon project setup, then add the public endpoints to
            Vercel.
          </div>
        ) : userEmail ? (
          <div className="mt-6 rounded-2xl bg-[#edf7f3] p-4">
            <p className="flex items-center gap-2 font-extrabold">
              <CheckCircle2 size={18} />
              Private cloud connected
            </p>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">{userEmail}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => neon.auth.signOut().then(() => setUserEmail(null))}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="grid grid-cols-2 rounded-xl bg-[#f0ebe2] p-1 text-sm font-bold">
              <button
                className={`min-h-10 rounded-lg ${mode === 'signin' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setMode('signin')}
              >
                Sign in
              </button>
              <button
                className={`min-h-10 rounded-lg ${mode === 'signup' ? 'bg-white shadow-sm' : ''}`}
                onClick={() => setMode('signup')}
              >
                Create account
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {mode === 'signup' && (
                <div>
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    className="mt-2 min-h-11"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  className="mt-2 min-h-11"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  className="mt-2 min-h-11"
                  type="password"
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="mt-2 text-xs text-[var(--muted-ink)]">
                  Use at least 12 characters. This is separate from the bundle
                  passphrase.
                </p>
              </div>
              <Button
                className="min-h-11 w-full bg-[#17201d] text-white"
                disabled={
                  !email.includes('@') ||
                  password.length < 12 ||
                  (mode === 'signup' && !name.trim()) ||
                  busy
                }
                onClick={submit}
              >
                {mode === 'signup' ? <UserPlus /> : <LockKeyhole />}
                {busy
                  ? 'Please wait…'
                  : mode === 'signup'
                    ? 'Create secure account'
                    : 'Unlock private cloud'}
              </Button>
              {message && (
                <output className="block rounded-xl bg-[var(--muted)] p-3 text-sm">
                  {message}
                </output>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
