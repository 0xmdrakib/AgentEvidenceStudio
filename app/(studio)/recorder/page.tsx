'use client';
import { FileKey2 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ImportBundle } from '@/components/import-bundle';
import { PageHeading } from '@/components/page-heading';
import { RunList } from '@/components/run-list';
import { useStudio } from '@/components/studio-provider';
export default function RecorderPage() { const { runs } = useStudio(); return <div className="mx-auto max-w-6xl"><PageHeading eyebrow="Module 01 · coral trajectory" title="Flight Recorder" description="An immutable causal timeline for role output, provider evidence, handoffs, delivery state, and approvals. Replay is evidence-only: it never re-executes an agent or network action." actions={<ImportBundle />} />{runs.length ? <RunList runs={runs} /> : <EmptyState icon={FileKey2} title="Nothing has been recorded" body="Runs appear here after hosted execution or encrypted bundle import. No sample records are injected into your workspace." action={<ImportBundle />} />}</div>; }
