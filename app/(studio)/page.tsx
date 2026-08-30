'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CircleDot, FileKey2, FlaskConical, GitMerge, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClayScene } from '@/components/clay-scene';
import { EmptyState } from '@/components/empty-state';
import { ImportBundle } from '@/components/import-bundle';
import { PageHeading } from '@/components/page-heading';
import { RunList } from '@/components/run-list';
import { useStudio } from '@/components/studio-provider';

export default function WorkspacePage() {
  const { runs, conflicts, runnerOnline, loading } = useStudio();
  const juryRunning = runs.filter((run) => run.module === 'jury' && run.state === 'running').length;
  return <div className="mx-auto max-w-[1480px]"><PageHeading eyebrow="Evidence workspace" title="See, merge, and verify every agent decision." description="Secure hosted execution works from any browser. Private history is encrypted before it reaches cloud storage." actions={<div className="flex flex-wrap gap-2"><ImportBundle /><Button nativeButton={false} render={<Link href="/jury/new" />} className="min-h-11 rounded-xl bg-[var(--ink)] !text-[#fffaf0]"><Plus />New run</Button></div>} />
    <section className="mb-7 grid gap-3 sm:grid-cols-3" aria-label="Workspace status">
      <Metric icon={CircleDot} label="Evidence runs" value={String(runs.length)} color="bg-[#ffd8d2]" />
      <Metric icon={AlertTriangle} label="Open conflicts" value={String(conflicts.length)} color="bg-[#e9e0ff]" />
      <Metric icon={FlaskConical} label="Research active" value={String(juryRunning)} color="bg-[#cfe3dc]" />
    </section>
    <section className="grid gap-4 xl:grid-cols-3">
      <ModuleCard module="recorder" href="/recorder" title="Flight Recorder" body="Trace causal events, delivery gaps, approvals, and replay stored evidence without re-running actions." />
      <ModuleCard module="memory" href="/memory" title="MemoryMerge" body="Create typed branch snapshots and resolve unsafe or competing changes before a canonical head moves." />
      <ModuleCard module="jury" href="/jury/new" title="Research Jury" body="Researcher, Challenger, and Adjudicator roles produce concise, source-bound findings." />
    </section>
    <section className="mt-9"><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow text-[var(--muted-ink)]">Local + synced</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Recent runs</h2></div>{runs.length > 0 && <Link href="/recorder" className="text-sm font-bold underline underline-offset-4">View all</Link>}</div>
      {loading ? <div className="paper h-64 animate-pulse rounded-[24px]" /> : runs.length ? <RunList runs={runs} limit={6} /> : <EmptyState icon={FileKey2} title="No evidence runs yet" body={runnerOnline ? 'Create a source-bound Jury run, or import an existing encrypted bundle.' : 'The administrator must finish hosted provider setup before new research can run.'} action={<Button nativeButton={false} render={<Link href={runnerOnline ? '/jury/new' : '/settings'} />} className="rounded-xl">{runnerOnline ? 'Start research' : 'View hosted status'}</Button>} />}
    </section>
  </div>;
}
function Metric({ icon: Icon, label, value, color }: { icon: typeof CircleDot; label: string; value: string; color: string }) { return <div className="paper flex items-center gap-4 rounded-[20px] p-4"><span className={`grid h-11 w-11 place-items-center rounded-[14px] ${color}`}><Icon size={20} /></span><span><span className="block text-2xl font-black tracking-tight">{value}</span><span className="block text-xs font-bold text-[var(--muted-ink)]">{label}</span></span></div>; }
function ModuleCard({ module, href, title, body }: { module: 'recorder' | 'memory' | 'jury'; href: string; title: string; body: string }) { const Icon = module === 'memory' ? GitMerge : module === 'jury' ? FlaskConical : CircleDot; return <Link href={href} className="paper group overflow-hidden rounded-[26px] transition hover:-translate-y-1 hover:shadow-[0_24px_55px_rgb(70_52_37/12%)]"><ClayScene module={module} /><div className="p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[var(--muted)]"><Icon size={19} /></span><ArrowUpRight className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></div><h2 className="mt-5 text-xl font-extrabold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{body}</p></div></Link>; }
