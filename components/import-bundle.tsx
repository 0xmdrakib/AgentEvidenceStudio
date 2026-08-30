'use client';
import { useRef, useState } from 'react';
import { FileKey2, Upload } from 'lucide-react';
import type { EncryptedRunBundle } from '@aes/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readJsonFile } from '@/lib/downloads';
import { useStudio } from './studio-provider';

export function ImportBundle() {
  const { importBundle } = useStudio(); const fileRef = useRef<HTMLInputElement>(null); const [passphrase, setPassphrase] = useState(''); const [file, setFile] = useState<File | null>(null); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => { if (!file) return; setBusy(true); try { const value = await readJsonFile(file) as EncryptedRunBundle; await importBundle(value, passphrase); setOpen(false); setFile(null); setPassphrase(''); } finally { setBusy(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" className="min-h-11 rounded-xl bg-white"><Upload />Import .aesrun</Button>} /><DialogContent className="rounded-[24px] bg-[var(--paper)] sm:max-w-md"><DialogHeader><DialogTitle>Import encrypted evidence</DialogTitle><DialogDescription>The bundle is decrypted only in this browser session. It is not uploaded automatically.</DialogDescription></DialogHeader><div className="space-y-4"><button type="button" onClick={() => fileRef.current?.click()} className="grid min-h-28 w-full place-items-center rounded-2xl border border-dashed bg-[#faf4ea] p-4 text-sm font-bold"><span><FileKey2 className="mx-auto mb-2" />{file?.name ?? 'Choose .aesrun bundle'}</span></button><input ref={fileRef} className="sr-only" type="file" accept=".aesrun,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div><Label htmlFor="bundle-passphrase">Workspace passphrase</Label><Input id="bundle-passphrase" className="mt-2 min-h-11" type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></div><Button className="min-h-11 w-full rounded-xl" disabled={!file || passphrase.length < 12 || busy} onClick={submit}>{busy ? 'Decrypting…' : 'Unlock bundle'}</Button></div></DialogContent></Dialog>;
}
