'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getGoogleSignInHref,
  isNeonSignInRequiredError,
  redirectToGoogleSignIn,
  type CloudBundleVersion,
} from '@/lib/neon';
import { useStudio } from './studio-provider';

export function CloudBundles() {
  const {
    accountId,
    accountLoading,
    cloudBundles,
    cloudLoading,
    cloudError,
    refreshCloud,
    openCloudBundle,
  } = useStudio();
  const [selected, setSelected] = useState<CloudBundleVersion | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setSelected(null);
    setPassphrase('');
    setError('');
  }, [accountId]);
  const close = () => {
    if (!busy) {
      setSelected(null);
      setPassphrase('');
      setError('');
    }
  };
  const unlock = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const run = await openCloudBundle(selected, passphrase);
      setSelected(null);
      setPassphrase('');
      router.push(`/recorder/${encodeURIComponent(run.id)}`);
    } catch (caught) {
      if (isNeonSignInRequiredError(caught)) redirectToGoogleSignIn();
      else
        setError(
          caught instanceof Error
            ? caught.message
            : 'Saved evidence could not be opened.',
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="paper mt-6 min-w-0 rounded-[24px] p-5 sm:p-6"
      aria-label="Saved account evidence"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <LockKeyhole size={20} className="shrink-0" />
            Saved to your account
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-ink)]">
            Encrypted versions stay here after a refresh or on another device.
            Use the original passphrase to open a version.
          </p>
        </div>
        {accountId && (
          <Button
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={cloudLoading}
            onClick={() => void refreshCloud()}
          >
            <RefreshCw size={16} />
            {cloudLoading ? 'Loading…' : 'Refresh'}
          </Button>
        )}
      </div>
      {accountLoading || cloudLoading ? (
        <p role="status" className="mt-5 text-sm text-[var(--muted-ink)]">
          Loading saved evidence…
        </p>
      ) : !accountId ? (
        <div className="mt-5">
          <p className="text-sm text-[var(--muted-ink)]">
            Sign in to import evidence and view your private account history.
          </p>
          <Button
            nativeButton={false}
            render={<Link href={getGoogleSignInHref('/recorder')} />}
            className="mt-3 min-h-11 rounded-xl"
          >
            Login with Google
          </Button>
        </div>
      ) : cloudError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[#fff0ed] p-3 text-sm text-[#8d2e27]"
        >
          {cloudError}
        </p>
      ) : cloudBundles.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--muted-ink)]">
          No encrypted versions saved yet. Import a bundle to save it to your
          account.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {cloudBundles.map((version) => (
            <li
              key={`${version.workspace_id}/${version.run_id}/${version.object_digest}`}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-[#fcf9f3] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-extrabold [overflow-wrap:anywhere]">
                  {version.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                  {new Date(version.created_at).toLocaleString()} ·{' '}
                  {Math.ceil(version.object_size / 1024)} KB · Encrypted
                </p>
              </div>
              <Button
                variant="outline"
                className="min-h-11 shrink-0 rounded-xl bg-white"
                onClick={() => {
                  setSelected(version);
                  setPassphrase('');
                  setError('');
                }}
              >
                Open saved version
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[24px] bg-[var(--paper)] [&_[data-slot=dialog-close]]:size-11 sm:max-w-md"
          showCloseButton={!busy}
        >
          <DialogHeader className="pr-9">
            <DialogTitle>Open saved evidence</DialogTitle>
            <DialogDescription>
              Enter this version’s original passphrase. Decryption happens in
              your browser and does not create another saved copy.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void unlock();
            }}
          >
            <p className="break-words font-bold [overflow-wrap:anywhere]">
              {selected?.title}
            </p>
            <div>
              <Label htmlFor="saved-bundle-passphrase">
                Original passphrase
              </Label>
              <Input
                id="saved-bundle-passphrase"
                className="mt-2 min-h-11"
                type="password"
                autoComplete="off"
                disabled={busy}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </div>
            {error && (
              <p
                role="alert"
                className="break-words rounded-xl bg-[#fff0ed] p-3 text-sm text-[#8d2e27]"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="min-h-11 w-full rounded-xl"
              disabled={passphrase.length < 12 || busy}
              aria-busy={busy}
            >
              {busy ? 'Opening evidence…' : 'Unlock saved version'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
