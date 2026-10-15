'use client';
import { FileKey2 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ImportBundle } from '@/components/import-bundle';
import { PageHeading } from '@/components/page-heading';
import { RunList } from '@/components/run-list';
import { useStudio } from '@/components/studio-provider';
import { CloudBundles } from '@/components/cloud-bundles';
export default function RecorderPage() {
  const { runs } = useStudio();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Module 01 · coral trajectory"
        title="Flight Recorder"
        description="An immutable causal timeline for role output, provider evidence, handoffs, delivery state, and approvals. Replay is evidence-only: it never re-executes an agent or network action."
        actions={<ImportBundle />}
      />
      {runs.length ? (
        <RunList runs={runs} />
      ) : (
        <EmptyState
          icon={FileKey2}
          title="No evidence opened yet"
          body="Open saved account evidence or import an encrypted bundle to start reviewing a run."
          action={<ImportBundle />}
        />
      )}
      <CloudBundles />
    </div>
  );
}
