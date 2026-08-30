'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Globe2,
  KeyRound,
  LockKeyhole,
  Plus,
  RadioTower,
  SearchCheck,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeading } from '@/components/page-heading';
import { useStudio } from '@/components/studio-provider';
import { getNeon, listCloudBundles } from '@/lib/neon';

export default function SettingsPage() {
  const { runnerOnline, client } = useStudio();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin-hosted control plane"
        title="Settings"
        description="The administrator operates one secure hosted service. Members sign in from any browser; no desktop agent, executable, or localhost runner is required."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <HostedEngine ready={runnerOnline} />
        <CloudSection />
        <div className="xl:col-span-2">
          <AdminProvider ready={runnerOnline} />
        </div>
        <div className="xl:col-span-2">
          <TrustSection create={(scope) => client.createApproval(scope)} />
        </div>
      </div>
    </div>
  );
}

function HostedEngine({ ready }: { ready: boolean }) {
  return (
    <section className="paper rounded-[24px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--ink)] text-white">
            <Globe2 size={20} />
          </span>
          <div>
            <p className="eyebrow text-[var(--muted-ink)]">Execution</p>
            <h2 className="mt-1 text-lg font-extrabold">Hosted engine</h2>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${ready ? 'bg-[#dcefea] text-[#225f4d]' : 'bg-[#fff0bd] text-[#6d5518]'}`}
        >
          {ready ? 'Online' : 'Admin setup needed'}
        </span>
      </div>
      <div className="mt-5 rounded-2xl border bg-[#f8f4ec] p-4">
        <p className="font-extrabold">One deployment for every member</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
          Research roles run inside protected Vercel functions. The provider key
          and database credentials remain server-only, while each request
          requires a signed-in Neon user.
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold">
        <span
          className={`h-2.5 w-2.5 rounded-full ${ready ? 'bg-[#38a27e]' : 'bg-amber-400'}`}
        />
        No localhost or PC availability dependency
      </div>
    </section>
  );
}

function CloudSection() {
  const configured = Boolean(getNeon());
  const [versions, setVersions] = useState<number | null>(null);
  useEffect(() => {
    if (configured)
      void listCloudBundles()
        .then((items) => setVersions(items.length))
        .catch(() => setVersions(null));
  }, [configured]);
  return (
    <section className="paper rounded-[24px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f1ede5]">
            <Cloud size={20} />
          </span>
          <div>
            <p className="eyebrow text-[var(--muted-ink)]">
              Identity + history
            </p>
            <h2 className="mt-1 text-lg font-extrabold">Neon private cloud</h2>
          </div>
        </div>
        <span className="rounded-full bg-[#f1ebe2] px-3 py-1 text-[10px] font-black uppercase">
          {configured ? 'Connected' : 'Needs setup'}
        </span>
      </div>
      <p className="mt-5 text-sm leading-6 text-[var(--muted-ink)]">
        Neon Auth isolates every member. Evidence bundles are encrypted in the
        browser before append-only, owner-scoped Neon rows receive them; the
        workspace passphrase is never sent to the host.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          nativeButton={false}
          render={<Link href="/auth" />}
          className="min-h-11 rounded-xl bg-[var(--ink)] !text-white"
        >
          {configured ? 'Open account' : 'Connect account'}
        </Button>
        {versions !== null && (
          <span className="rounded-full bg-[#e9ffc1] px-3 py-2 text-xs font-extrabold">
            {versions} encrypted version{versions === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </section>
  );
}

function AdminProvider({ ready }: { ready: boolean }) {
  const features = [
    {
      icon: SearchCheck,
      title: 'Web-grounded roles',
      body: 'Researcher and Challenger can use bounded hosted web search.',
    },
    {
      icon: ShieldCheck,
      title: 'Strict evidence schemas',
      body: 'Every role is validated and gets at most one repair attempt.',
    },
    {
      icon: LockKeyhole,
      title: 'Server-only secret',
      body: 'Members never see or submit the administrator provider key.',
    },
  ];
  return (
    <section className="paper overflow-hidden rounded-[24px]">
      <header className="flex flex-col gap-3 border-b bg-[var(--ink)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#c8ff65] text-[var(--ink)]">
            <ServerCog size={20} />
          </span>
          <div>
            <p className="eyebrow text-white/55">Administrator managed</p>
            <h2 className="mt-1 text-xl font-extrabold">
              Hosted Research Jury provider
            </h2>
          </div>
        </div>
        <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase">
          {ready ? 'Configured' : 'Awaiting environment'}
        </span>
      </header>
      <div className="grid gap-3 p-5 md:grid-cols-3 sm:p-6">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border bg-[#fcf9f3] p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f1ee] text-[var(--teal)]">
              <Icon size={19} />
            </span>
            <h3 className="mt-4 text-sm font-extrabold">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSection({
  create,
}: {
  create(scope: unknown): Promise<unknown>;
}) {
  return (
    <section className="paper overflow-hidden rounded-[24px]">
      <header className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--ochre)]">
            <RadioTower size={20} />
          </span>
          <div>
            <p className="eyebrow text-[var(--muted-ink)]">
              Optional signed summaries
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              Technocore bounded approval
            </h2>
          </div>
        </div>
        <span className="w-fit rounded-full bg-[#fff0bd] px-3 py-1 text-[10px] font-black uppercase">
          Human controlled
        </span>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="p-5 sm:p-6">
          <ApprovalForm create={create} />
        </div>
        <aside className="border-t bg-[#f5f0e8] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9e0ff]">
              <KeyRound size={20} />
            </span>
            <div>
              <p className="eyebrow text-[var(--muted-ink)]">
                Recovery boundary
              </p>
              <h3 className="mt-1 font-extrabold">What stays separate</h3>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-xs leading-5 text-[var(--muted-ink)]">
            <li className="rounded-2xl border bg-white p-3">
              <strong className="text-[var(--ink)]">Private evidence:</strong>{' '}
              encrypted in the member browser.
            </li>
            <li className="rounded-2xl border bg-white p-3">
              <strong className="text-[var(--ink)]">Public reports:</strong>{' '}
              require a redaction preview and explicit publish action.
            </li>
            <li className="rounded-2xl border bg-white p-3">
              <strong className="text-[var(--ink)]">External actions:</strong>{' '}
              GitHub, X, ownership transfers, and public rooms are never part of
              a run approval.
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

function ApprovalForm({
  create,
}: {
  create(scope: unknown): Promise<unknown>;
}) {
  const [roomId, setRoomId] = useState('');
  const [controllerDid, setControllerDid] = useState('');
  const [maximumWrites, setMaximumWrites] = useState(8);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1_000).toISOString();
    await create({
      roomId,
      controllerDid,
      eventKinds: [
        'run.started',
        'role.completed',
        'merge.completed',
        'run.completed',
        'run.failed',
      ],
      maximumWrites,
      expiresAt,
    });
    setMessage(
      `Exact scope approved until ${new Date(expiresAt).toLocaleTimeString()}.`,
    );
  };
  return (
    <div>
      <div className="mb-4">
        <h3 className="font-extrabold">Approve one exact scope</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
          Room, controller DID, event kinds, cap, and two-hour expiry are locked
          into one digest.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1.35fr_140px]">
        <Field id="room-id" label="Owned room">
          <Input
            id="room-id"
            className="min-h-11"
            placeholder="d-p-your-room"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
          />
        </Field>
        <Field id="controller-did" label="Controller DID">
          <Input
            id="controller-did"
            className="min-h-11 font-mono text-xs"
            placeholder="did:key:z6Mk…"
            value={controllerDid}
            onChange={(event) => setControllerDid(event.target.value)}
          />
        </Field>
        <Field id="write-cap" label="Write cap">
          <Input
            id="write-cap"
            className="min-h-11"
            type="number"
            min={1}
            max={8}
            value={maximumWrites}
            onChange={(event) => setMaximumWrites(Number(event.target.value))}
          />
        </Field>
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#fff8df] p-3 text-xs leading-5">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
        />
        <span>
          I approve only this exact scope. Any field change invalidates it.
        </span>
      </label>
      <Button
        className="mt-3 min-h-11 rounded-xl"
        disabled={
          !confirmed ||
          !roomId ||
          !controllerDid ||
          maximumWrites < 1 ||
          maximumWrites > 8
        }
        onClick={submit}
      >
        <Plus />
        Create bounded approval
      </Button>
      {message && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#28755f]">
          <CheckCircle2 size={15} />
          {message}
        </p>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}
