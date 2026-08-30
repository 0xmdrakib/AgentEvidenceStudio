'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EncryptedRunBundle, ProviderProfile, RunRecord } from '@aes/contracts';
import { decryptBundle } from '@aes/core';
import { RunnerClient } from '@/lib/runner-client';
import {
  isNeonSignInRequiredError,
  redirectToGoogleSignIn,
} from '@/lib/neon';

interface StudioState {
  runnerOnline: boolean; vaultUnlocked: boolean; loading: boolean;
  error: string | null; clearError(): void; runs: RunRecord[]; providers: ProviderProfile[]; conflicts: any[];
  refresh(): Promise<void>; saveProvider(profile: ProviderProfile): Promise<void>;
  startJury(question: string, providerId: string): Promise<RunRecord>;
  importBundle(bundle: EncryptedRunBundle, passphrase: string): Promise<RunRecord>; client: RunnerClient;
}
const StudioContext = createContext<StudioState | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [runnerOnline, setRunnerOnline] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [runs, setRuns] = useState<RunRecord[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]); const [conflicts, setConflicts] = useState<any[]>([]);
  const client = useMemo(() => new RunnerClient(), []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [health, runData, providerData, conflictData] = await Promise.all([client.health(), client.listRuns(), client.listProviders(), client.listConflicts()]);
      setRunnerOnline(health.configured); setVaultUnlocked(false); setRuns(runData.runs); setProviders(providerData.providers); setConflicts(conflictData.conflicts); setError(null);
    } catch { setRunnerOnline(false); setVaultUnlocked(false); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void refresh(); }, [refresh]);
  const saveProvider = async (profile: ProviderProfile) => { try { await client.saveProvider(profile); await refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); throw caught; } };
  const startJury = async (question: string, providerId: string) => { setError(null); try { const { run } = await client.runJury(question, providerId); await refresh(); return run; } catch (caught) { if (isNeonSignInRequiredError(caught)) redirectToGoogleSignIn(); else setError(caught instanceof Error ? caught.message : String(caught)); throw caught; } };
  const importBundle = async (bundle: EncryptedRunBundle, passphrase: string) => { try { const run = await decryptBundle(bundle, passphrase); setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]); return run; } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); throw caught; } };
  return <StudioContext.Provider value={{ runnerOnline, vaultUnlocked, loading, error, clearError: () => setError(null), runs, providers, conflicts, refresh, saveProvider, startJury, importBundle, client }}>{children}</StudioContext.Provider>;
}
export function useStudio(): StudioState { const state = useContext(StudioContext); if (!state) throw new Error('useStudio must be used inside StudioProvider.'); return state; }
