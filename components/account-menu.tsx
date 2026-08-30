'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  getCurrentNeonUser,
  getGoogleSignInHref,
  getNeon,
} from '@/lib/neon';

type AccountUser = Awaited<ReturnType<typeof getCurrentNeonUser>>;

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<AccountUser>(null);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      void getCurrentNeonUser()
        .then((current) => active && setUser(current))
        .finally(() => active && setChecking(false));
    refresh();
    const listener = getNeon()?.auth.onAuthStateChange?.(
      (_event: unknown, session: any) => {
        if (!active) return;
        if (session?.user?.id) refresh();
        else {
          setUser(null);
          setChecking(false);
        }
      },
    ) as any;
    return () => {
      active = false;
      listener?.data?.subscription?.unsubscribe?.();
      listener?.subscription?.unsubscribe?.();
      listener?.unsubscribe?.();
    };
  }, []);

  useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const returnTo = pathname?.startsWith('/') ? pathname : '/';
  if (checking) {
    return (
      <span
        aria-label="Checking account"
        className="block h-11 w-20 animate-pulse rounded-xl bg-black/5"
      />
    );
  }
  if (!user) {
    return (
      <Button
        nativeButton={false}
        render={<Link href={getGoogleSignInHref(returnTo)} />}
        variant="outline"
        className={`${compact ? 'px-3' : 'px-4'} min-h-11 rounded-xl bg-white font-extrabold`}
      >
        <LogIn size={17} />
        Login
      </Button>
    );
  }

  const label = user.name ?? user.email ?? 'Account';
  const initial = label.trim().charAt(0).toUpperCase() || 'A';
  const signOut = async () => {
    await getNeon()?.auth.signOut();
    window.location.assign('/');
  };

  return (
    <div ref={root} className="relative">
      <Button
        variant="outline"
        className={`${compact ? 'px-2' : 'px-2.5'} min-h-11 rounded-xl bg-white`}
        aria-label={`Open account menu for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {user.avatarUrl && !avatarFailed ? (
          <Image
            src={user.avatarUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            width={32}
            height={32}
            unoptimized
            onError={() => setAvatarFailed(true)}
            className="h-8 w-8 rounded-full object-cover ring-1 ring-black/10"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e9ffc1] text-xs font-black">
            {initial}
          </span>
        )}
        <ChevronDown size={15} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border bg-[var(--paper)] p-2 shadow-[0_20px_50px_rgb(16_35_30/18%)]"
        >
          <div className="border-b px-3 py-3">
            <p className="truncate text-sm font-extrabold">{label}</p>
            {user.email && user.name && (
              <p className="mt-1 truncate text-xs text-[var(--muted-ink)]">
                {user.email}
              </p>
            )}
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-[#f5f0e8]"
            onClick={() => setOpen(false)}
          >
            <Settings size={17} />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-[#9b352c] hover:bg-[#fff0ed]"
            onClick={signOut}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
