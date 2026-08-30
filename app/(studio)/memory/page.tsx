'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeading } from '@/components/page-heading';
import { useStudio } from '@/components/studio-provider';

export default function MemoryPage() {
  const { client, conflicts, refresh } = useStudio();
  const [branch, setBranch] = useState('main');
  const [base, setBase] = useState('{}');
  const [left, setLeft] = useState('{}');
  const [right, setRight] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const merge = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const [baseSnapshot, leftSnapshot, rightSnapshot] = await Promise.all([
        client.createSnapshot(`${branch}:base`, JSON.parse(base)),
        client.createSnapshot(`${branch}:left`, JSON.parse(left)),
        client.createSnapshot(`${branch}:right`, JSON.parse(right)),
      ]);
      await client.mergeMemory({
        baseDigest: baseSnapshot.snapshot.digest,
        leftDigest: leftSnapshot.snapshot.digest,
        rightDigest: rightSnapshot.snapshot.digest,
        branch,
      });
      setMessage('Merged safely and created a new canonical head.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      await refresh();
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Module 02 · lavender branches"
        title="MemoryMerge"
        description="Three-way merge for typed JSON memory. Disjoint changes merge automatically; competing scalars, arrays, deletions, instructions, credentials, code, and financial balances require a person."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <section className="paper rounded-[24px] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9e0ff]">
              <GitMerge />
            </span>
            <div>
              <h2 className="font-extrabold">New three-way merge</h2>
              <p className="text-xs text-[var(--muted-ink)]">
                JSON only · no executable content
              </p>
            </div>
          </div>
          <div className="mb-4">
            <Label htmlFor="branch">Target branch</Label>
            <Input
              id="branch"
              className="mt-2 min-h-11"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <JsonEditor
              label="Base"
              value={base}
              onChange={setBase}
              color="border-stone-300"
            />
            <JsonEditor
              label="Left"
              value={left}
              onChange={setLeft}
              color="border-[var(--lavender)]"
            />
            <JsonEditor
              label="Right"
              value={right}
              onChange={setRight}
              color="border-[var(--mint)]"
            />
          </div>
          {message && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-[var(--muted)] p-3 text-sm font-semibold"
            >
              {message}
            </p>
          )}
          <Button
            className="mt-5 min-h-12 w-full rounded-xl bg-[#6e5bb5]"
            disabled={busy}
            onClick={merge}
          >
            {busy ? 'Comparing branches…' : 'Compare and merge'}
          </Button>
        </section>
        <section className="paper flex min-h-[530px] flex-col rounded-[24px] p-5 sm:p-6">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[#f8f4ec] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9e0ff] text-[#5f4f8e]">
                <Layers3 size={20} />
              </span>
              <div>
                <p className="eyebrow text-[var(--muted-ink)]">Human gate</p>
                <h2 className="mt-1 text-xl font-extrabold">Open conflicts</h2>
              </div>
            </div>
            <span className="grid h-11 min-w-11 place-items-center rounded-full bg-[#e9e0ff] font-black text-[#4f3d7a]">
              {conflicts.length}
            </span>
          </div>
          {conflicts.length ? (
            <div className="mt-4 space-y-4">
              {conflicts.map((conflict) => (
                <ConflictCard key={conflict.id} conflict={conflict} />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid flex-1 place-items-center rounded-2xl border border-dashed border-[#ddd4c7] bg-[#fffdf8] p-8 text-center">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] border border-[#e4ddd2] bg-[#f8f4ec] text-[#6e5bb5] shadow-sm">
                  <CheckCircle2 size={27} />
                </span>
                <h3 className="mt-5 text-xl font-extrabold">
                  Canonical head is clear
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-ink)]">
                  No branch is blocked. When two agents change the same value,
                  the base, left, and right evidence will appear here for a
                  human decision.
                </p>
                <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[var(--lavender)]" />
                  <span className="h-px w-12 bg-[#c9c0b5]" />
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--mint)]">
                    <GitMerge size={14} />
                  </span>
                  <span className="h-px w-12 bg-[#c9c0b5]" />
                  <span className="h-3 w-3 rounded-full bg-[var(--mint)]" />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function JsonEditor({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  color: string;
}) {
  const valid = useMemo(() => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, [value]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor={`memory-${label}`}>{label}</Label>
        <span
          className={`text-[10px] font-black uppercase ${valid ? 'text-[#28755f]' : 'text-[var(--destructive)]'}`}
        >
          {valid ? 'valid JSON' : 'invalid'}
        </span>
      </div>
      <Textarea
        id={`memory-${label}`}
        className={`scrollbar-thin min-h-64 resize-y rounded-2xl border-2 bg-[#fcf9f3] font-mono text-xs leading-5 ${color}`}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function ConflictCard({ conflict }: { conflict: any }) {
  const { client, refresh } = useStudio();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const resolve = async () => {
    const resolutions: Record<string, unknown> = {};
    for (const item of conflict.conflicts) {
      const choice = choices[item.path];
      if (!choice) return;
      resolutions[item.path] = {
        choice,
        ...(choice === 'custom'
          ? { custom: JSON.parse(custom[item.path]) }
          : {}),
      };
    }
    setBusy(true);
    try {
      await client.resolveConflict(conflict.id, resolutions);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="paper rounded-[22px] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0ed]">
          <AlertTriangle size={19} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold">
            {conflict.conflicts.length} competing change
            {conflict.conflicts.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-[var(--muted-ink)]">{conflict.id}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {conflict.conflicts.map((item: any) => (
          <div key={item.path} className="rounded-2xl border bg-[#faf6ef] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="text-xs font-bold">{item.path}</code>
              <span className="rounded-full bg-[#ffe1eb] px-2 py-1 text-[10px] font-black uppercase">
                {item.reason}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
              {(['base', 'left', 'right'] as const).map((side) => (
                <div key={side} className="rounded-xl bg-white p-2">
                  <span className="font-black uppercase text-[var(--muted-ink)]">
                    {side}
                  </span>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(item[side], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Select
                value={choices[item.path] ?? null}
                onValueChange={(value) =>
                  setChoices((current) => ({
                    ...current,
                    [item.path]: value ?? '',
                  }))
                }
              >
                <SelectTrigger className="min-h-11 bg-white">
                  <SelectValue placeholder="Choose resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Keep left</SelectItem>
                  <SelectItem value="right">Keep right</SelectItem>
                  <SelectItem value="base">Restore base</SelectItem>
                  <SelectItem value="custom">Validated custom value</SelectItem>
                </SelectContent>
              </Select>
              {choices[item.path] === 'custom' && (
                <Textarea
                  className="mt-2 bg-white font-mono text-xs"
                  placeholder='Custom JSON value, for example: "approved"'
                  value={custom[item.path] ?? ''}
                  onChange={(event) =>
                    setCustom((current) => ({
                      ...current,
                      [item.path]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <Button
        className="mt-4 w-full"
        disabled={
          busy || conflict.conflicts.some((item: any) => !choices[item.path])
        }
        onClick={resolve}
      >
        <CheckCircle2 />
        {busy ? 'Creating canonical head…' : 'Resolve every conflict'}
      </Button>
    </article>
  );
}
