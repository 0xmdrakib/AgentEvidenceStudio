'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  FileCheck2,
  FlaskConical,
  GitCompareArrows,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AccountMenu } from './account-menu';
import { useStudio } from './studio-provider';

const items = [{ href: '/', key: 'workspace', icon: Activity }, { href: '/recorder', key: 'recorder', icon: FileCheck2 }, { href: '/memory', key: 'memory', icon: GitCompareArrows }, { href: '/jury/new', key: 'jury', icon: FlaskConical }, { href: '/reports', key: 'reports', icon: ShieldCheck }, { href: '/settings', key: 'settings', icon: Settings }] as const;
const labels = { workspace: 'Workspace', recorder: 'Flight Recorder', memory: 'MemoryMerge', jury: 'Research Jury', reports: 'Reports', settings: 'Settings' } as const;
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { error, clearError } = useStudio();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return <div data-app-hydrated={hydrated ? 'true' : 'false'} className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-[var(--cream)]/95 px-3 backdrop-blur sm:px-4 lg:hidden"><Brand /><div className="flex items-center gap-1.5"><AccountMenu compact /><Button className="size-11" variant="ghost" size="icon" aria-label="Open navigation" disabled={!hydrated} onClick={() => setOpen(true)}><Menu /></Button></div></header>
    {open && <button className="fixed inset-0 z-40 bg-black/25 lg:hidden" aria-label="Close navigation overlay" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,272px)] flex-col border-r bg-[#f8f1e6] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-10 flex items-center justify-between"><Brand /><Button className="size-11 lg:hidden" variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></Button></div>
      <nav className="space-y-1" aria-label="Primary navigation">{items.map(({ href, key, icon: Icon }) => { const active = href === '/' ? pathname === '/' : pathname.startsWith(href.split('/').slice(0, 2).join('/')); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? 'bg-[var(--ink)] !text-[#fffaf0] shadow-md' : 'text-[var(--muted-ink)] hover:bg-white/70 hover:text-[var(--ink)]'}`}><Icon size={18} strokeWidth={2.2} />{labels[key]}</Link>; })}</nav>
      <div className="mt-auto"><Link href="/jury/new" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--coral)] px-4 text-sm font-extrabold text-[var(--ink)] shadow-[0_8px_0_#d84a3c] transition hover:-translate-y-0.5"><Plus size={18} />New run</Link>
      </div>
    </aside>
    <main className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col px-4 py-6 sm:px-7 lg:min-h-screen lg:px-10 lg:py-9 xl:px-14">
      <div className="mb-5 hidden min-h-11 items-center justify-end lg:flex"><AccountMenu /></div>
      {error && <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-[#d89287] bg-[#fff0ed] p-4 text-sm"><span>{error}</span><button className="font-bold" onClick={clearError}>Dismiss</button></div>}
      <div className="flex-1">{children}</div>
      <footer className="pt-10 text-center text-xs font-semibold tracking-wide text-[var(--muted-ink)] sm:pt-12">
        © 2026 Md. Rakib&nbsp;•&nbsp;made with love and passion.
      </footer>
    </main>
  </div>;
}
function Brand() { return <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Agent Evidence Studio home"><Image src="/brand/agent-evidence-logo.svg" alt="" aria-hidden="true" width={202} height={40} unoptimized className="h-8 w-auto max-w-[132px] sm:h-10 sm:max-w-[202px]" /></Link>; }
