'use client';
import Link from 'next/link';
import { ArrowUpRight, FlaskConical, GitMerge, RadioTower } from 'lucide-react';
import type { RunRecord } from '@aes/contracts';
import { StateBadge } from './state-badge';
const icons = { recorder: RadioTower, memory: GitMerge, jury: FlaskConical };
export function RunList({ runs, limit }: { runs: RunRecord[]; limit?: number }) { return <div className="overflow-hidden rounded-[22px] border bg-[var(--paper)]">{runs.slice(0, limit ?? runs.length).map((run, index) => { const Icon = icons[run.module]; return <Link key={run.id} href={`/recorder/${run.id}`} className={`grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 transition hover:bg-[#faf3e8] sm:px-5 ${index ? 'border-t' : ''}`}><span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[var(--muted)]"><Icon size={20} /></span><span className="min-w-0"><span className="block truncate text-sm font-extrabold">{run.title}</span><span className="mt-1 block text-xs text-[var(--muted-ink)]">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(run.updatedAt))} · {run.events.length} events</span></span><span className="flex items-center gap-3"><StateBadge state={run.state} /><ArrowUpRight className="hidden sm:block" size={18} /></span></Link>; })}</div>; }
