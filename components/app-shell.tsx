'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, FileCheck2, FlaskConical, GitCompareArrows, Menu, Plus, ScanSearch, Settings, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useStudio } from './studio-provider';

const items = [{ href: '/', key: 'workspace', icon: Activity }, { href: '/recorder', key: 'recorder', icon: FileCheck2 }, { href: '/memory', key: 'memory', icon: GitCompareArrows }, { href: '/jury/new', key: 'jury', icon: FlaskConical }, { href: '/reports', key: 'reports', icon: ShieldCheck }, { href: '/settings', key: 'settings', icon: Settings }] as const;
const labels = { workspace: 'Workspace', recorder: 'Flight Recorder', memory: 'MemoryMerge', jury: 'Research Jury', reports: 'Reports', settings: 'Settings' } as const;
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const { error, clearError } = useStudio(); const [open, setOpen] = useState(false); const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return <div data-app-hydrated={hydrated ? 'true' : 'false'} className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-[var(--cream)]/95 px-4 backdrop-blur lg:hidden"><Brand /><Button className="size-11" variant="ghost" size="icon" aria-label="Open navigation" disabled={!hydrated} onClick={() => setOpen(true)}><Menu /></Button></header>
    {open && <button className="fixed inset-0 z-40 bg-black/25 lg:hidden" aria-label="Close navigation overlay" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,272px)] flex-col border-r bg-[#f8f1e6] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-10 flex items-center justify-between"><Brand /><Button className="size-11 lg:hidden" variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></Button></div>
      <nav className="space-y-1" aria-label="Primary navigation">{items.map(({ href, key, icon: Icon }) => { const active = href === '/' ? pathname === '/' : pathname.startsWith(href.split('/').slice(0, 2).join('/')); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active ? 'bg-[var(--ink)] !text-[#fffaf0] shadow-md' : 'text-[var(--muted-ink)] hover:bg-white/70 hover:text-[var(--ink)]'}`}><Icon size={18} strokeWidth={2.2} />{labels[key]}</Link>; })}</nav>
      <div className="mt-auto"><Link href="/jury/new" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--coral)] px-4 text-sm font-extrabold text-[var(--ink)] shadow-[0_8px_0_#d84a3c] transition hover:-translate-y-0.5"><Plus size={18} />New run</Link>
      </div>
    </aside>
    <main className="min-w-0 px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-14">{error && <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-[#d89287] bg-[#fff0ed] p-4 text-sm"><span>{error}</span><button className="font-bold" onClick={clearError}>Dismiss</button></div>}{children}</main>
  </div>;
}
function Brand() { return <Link href="/" className="flex items-center gap-3" aria-label="Agent Evidence Studio home"><span className="relative grid h-11 w-11 place-items-center rounded-[15px] bg-[var(--ink)] text-[var(--cream)] shadow-[3px_3px_0_var(--coral)]"><ScanSearch size={23} strokeWidth={2.2} /><span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full bg-[#c8ff65] ring-2 ring-[var(--ink)]" /></span><span><span className="block text-sm font-extrabold tracking-[-0.02em]">Agent Evidence</span><span className="block text-xs font-semibold text-[var(--muted-ink)]">Studio</span></span></Link>; }
