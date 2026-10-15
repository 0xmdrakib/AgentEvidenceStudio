'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ProviderProfile, RunRecord } from '@aes/contracts';
import { RunnerClient } from '@/lib/runner-client';
import { importPrivateBundle, openPrivateBundle } from '@/lib/private-bundles';
import {
  downloadCloudBundle,
  getCurrentNeonUser,
  getNeon,
  getNeonSession,
  isNeonSignInRequiredError,
  listCloudBundles,
  NeonSignInRequiredError,
  redirectToGoogleSignIn,
  requireSameNeonAccount,
  subscribeToNeonSignOut,
  type CloudBundleVersion,
} from '@/lib/neon';

interface StudioState {
  runnerOnline: boolean;
  vaultUnlocked: boolean;
  loading: boolean;
  accountId: string | null;
  accountLoading: boolean;
  error: string | null;
  clearError(): void;
  runs: RunRecord[];
  providers: ProviderProfile[];
  conflicts: any[];
  cloudBundles: CloudBundleVersion[];
  cloudLoading: boolean;
  cloudError: string | null;
  refresh(): Promise<void>;
  refreshCloud(): Promise<void>;
  startJury(
    question: string,
    providerId: string,
    sourceUrls: string[],
  ): Promise<RunRecord>;
  importBundle(bundle: unknown, passphrase: string): Promise<RunRecord>;
  openCloudBundle(
    version: CloudBundleVersion,
    passphrase: string,
  ): Promise<RunRecord>;
  client: RunnerClient;
}
const StudioContext = createContext<StudioState | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [runnerOnline, setRunnerOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [cloudBundles, setCloudBundles] = useState<CloudBundleVersion[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const cloudRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const client = useMemo(() => new RunnerClient(), []);
  const changeAccount = useCallback(
    (id: string | null) => {
      if (owner.current !== id) {
        owner.current = id;
        cloudRequest.current++;
        client.setAccount(id);
        setRuns([]);
        setConflicts([]);
        setCloudBundles([]);
        setCloudError(null);
        setCloudLoading(false);
        setError(null);
      }
      setAccountId(id);
      setAccountLoading(false);
    },
    [client],
  );
  useEffect(() => {
    let active = true;
    let revision = 0;
    const check = () => {
      const request = ++revision;
      void getCurrentNeonUser()
        .then((user) => {
          if (active && request === revision) changeAccount(user?.id ?? null);
        })
        .catch(() => {
          if (active && request === revision) changeAccount(null);
        });
    };
    check();
    const listener = getNeon()?.auth.onAuthStateChange?.(() => check()) as any;
    const stop = subscribeToNeonSignOut(() => {
      revision++;
      changeAccount(null);
    });
    window.addEventListener('focus', check);
    return () => {
      active = false;
      stop();
      window.removeEventListener('focus', check);
      listener?.data?.subscription?.unsubscribe?.();
      listener?.subscription?.unsubscribe?.();
      listener?.unsubscribe?.();
    };
  }, [changeAccount]);
  const refresh = useCallback(async () => {
    setLoading(true);
    const requestOwner = owner.current;
    const [health, runData, providerData, conflictData] =
      await Promise.allSettled([
        client.health(),
        client.listRuns(),
        client.listProviders(),
        client.listConflicts(),
      ]);
    setRunnerOnline(health.status === 'fulfilled' && health.value.configured);
    if (providerData.status === 'fulfilled')
      setProviders(providerData.value.providers);
    if (owner.current === requestOwner) {
      if (runData.status === 'fulfilled') setRuns(runData.value.runs);
      if (conflictData.status === 'fulfilled')
        setConflicts(conflictData.value.conflicts);
    }
    setLoading(false);
  }, [client]);
  const refreshCloud = useCallback(async () => {
    const id = owner.current;
    const request = ++cloudRequest.current;
    if (!id) {
      setCloudBundles([]);
      setCloudLoading(false);
      return;
    }
    setCloudLoading(true);
    setCloudError(null);
    try {
      const versions = await listCloudBundles();
      if (request === cloudRequest.current && owner.current === id)
        setCloudBundles(versions);
    } catch (caught) {
      if (request === cloudRequest.current && owner.current === id) {
        setCloudBundles([]);
        setCloudError(
          isNeonSignInRequiredError(caught)
            ? 'Sign in again to load saved evidence.'
            : 'Saved evidence could not be loaded. Please retry.',
        );
      }
    } finally {
      if (request === cloudRequest.current) setCloudLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    void refreshCloud();
  }, [accountId, refreshCloud]);
  const remember = (run: RunRecord, id: string) => {
    if (owner.current !== id) throw new NeonSignInRequiredError();
    client.rememberRun(run, id);
    setRuns((current) => [
      run,
      ...current.filter((item) => item.id !== run.id),
    ]);
    setError(null);
    return run;
  };
  const startJury = async (
    question: string,
    providerId: string,
    sourceUrls: string[],
  ) => {
    setError(null);
    try {
      const { run } = await client.runJury(question, providerId, sourceUrls);
      await refresh();
      return run;
    } catch (caught) {
      if (isNeonSignInRequiredError(caught)) redirectToGoogleSignIn();
      else setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    }
  };
  const importBundle = async (bundle: unknown, passphrase: string) => {
    const result = await importPrivateBundle(bundle, passphrase);
    const run = remember(result.run, result.ownerId);
    await refreshCloud();
    return run;
  };
  const openCloudBundle = async (
    version: CloudBundleVersion,
    passphrase: string,
  ) => {
    const { userId } = await getNeonSession();
    const bundle = await downloadCloudBundle(version);
    if (
      bundle.runId !== version.run_id ||
      bundle.payload.digest !== version.object_digest
    )
      throw new Error('The saved version does not match its account record.');
    const run = await openPrivateBundle(bundle, passphrase, userId);
    await requireSameNeonAccount(userId);
    return remember(run, userId);
  };
  return (
    <StudioContext.Provider
      value={{
        runnerOnline,
        vaultUnlocked: runs.length > 0,
        loading,
        accountId,
        accountLoading,
        error,
        clearError: () => setError(null),
        runs,
        providers,
        conflicts,
        cloudBundles,
        cloudLoading,
        cloudError,
        refresh,
        refreshCloud,
        startJury,
        importBundle,
        openCloudBundle,
        client,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}
export function useStudio(): StudioState {
  const state = useContext(StudioContext);
  if (!state) throw new Error('useStudio must be used inside StudioProvider.');
  return state;
}
