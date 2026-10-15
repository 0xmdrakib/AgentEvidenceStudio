'use client';
import { useEffect, useRef, useState } from 'react';
import { FileKey2, Upload } from 'lucide-react';
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
import { readJsonFile } from '@/lib/downloads';
import {
  DEFAULT_ACCOUNT_LIMITS,
  getNeonSession,
  isNeonSignInRequiredError,
  redirectToGoogleSignIn,
} from '@/lib/neon';
import { useStudio } from './studio-provider';

export function ImportBundle() {
  const { importBundle, accountId, accountLoading } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setOpen(false);
    setFile(null);
    setPassphrase('');
    setError('');
    setNotice('');
  }, [accountId]);
  const fail = (caught: unknown) => {
    if (isNeonSignInRequiredError(caught)) redirectToGoogleSignIn();
    else
      setError(
        caught instanceof Error
          ? caught.message
          : 'Import could not be saved. Please retry.',
      );
  };
  const begin = async () => {
    setChecking(true);
    setError('');
    setNotice('');
    try {
      await getNeonSession();
      setOpen(true);
    } catch (caught) {
      fail(caught);
    } finally {
      setChecking(false);
    }
  };
  const close = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setPassphrase('');
      setFile(null);
      setError('');
    }
  };
  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await getNeonSession();
      const value = await readJsonFile(
        file,
        DEFAULT_ACCOUNT_LIMITS.bundleBytes,
      );
      await importBundle(value, passphrase);
      setOpen(false);
      setFile(null);
      setPassphrase('');
      setNotice('Encrypted evidence saved to your account.');
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-w-0">
      <Dialog open={open} onOpenChange={close}>
        <Button
          variant="outline"
          aria-haspopup="dialog"
          disabled={accountLoading || checking}
          onClick={begin}
          className="min-h-11 rounded-xl bg-white"
        >
          <Upload />
          {checking ? 'Checking account…' : 'Import .aesrun'}
        </Button>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[24px] bg-[var(--paper)] [&_[data-slot=dialog-close]]:size-11 sm:max-w-md"
          showCloseButton={!busy}
        >
          <DialogHeader className="pr-9">
            <DialogTitle>Import encrypted evidence</DialogTitle>
            <DialogDescription>
              Your encrypted file is saved to your account within your 10 MB
              allowance. Its contents unlock in this browser; your passphrase is
              never uploaded.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-w-0 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="grid min-h-28 w-full min-w-0 place-items-center rounded-2xl border border-dashed bg-[#faf4ea] p-4 text-sm font-bold"
            >
              <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
                <FileKey2 className="mx-auto mb-2" />
                {file?.name ?? 'Choose .aesrun bundle'}
              </span>
            </button>
            <input
              ref={fileRef}
              className="sr-only"
              aria-label="Encrypted evidence file"
              type="file"
              accept=".aesrun,application/json"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError('');
              }}
            />
            <p className="text-xs text-[var(--muted-ink)]">
              Maximum file size: 512 KB. Keep your passphrase or recovery kit to
              open it later.
            </p>
            <div>
              <Label htmlFor="bundle-passphrase">Workspace passphrase</Label>
              <Input
                id="bundle-passphrase"
                className="mt-2 min-h-11"
                type="password"
                autoComplete="off"
                value={passphrase}
                disabled={busy}
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
              disabled={!file || passphrase.length < 12 || busy}
              aria-busy={busy}
            >
              {busy ? 'Saving encrypted evidence…' : 'Save and open bundle'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {!open && error && (
        <p role="alert" className="mt-2 max-w-xs text-sm text-[#8d2e27]">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-2 max-w-xs text-xs leading-5 text-[#28755f]"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
