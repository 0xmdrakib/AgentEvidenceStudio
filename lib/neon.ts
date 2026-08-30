import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import type {
  AesReportV1,
  EncryptedRunBundle,
  RunRecord,
} from '@aes/contracts';

type WorkspaceRow = {
  id: string;
  owner_id: string;
  name: string;
  key_fingerprint: string;
  recovery_confirmed_at: string;
  created_at: string;
};
type RunMetadataRow = {
  owner_id: string;
  workspace_id: string;
  run_id: string;
  module: RunRecord['module'];
  state: RunRecord['state'];
  title: string;
  created_at: string;
  updated_at: string;
};
type BundleVersionRow = {
  id: string;
  owner_id: string;
  workspace_id: string;
  run_id: string;
  object_path: string;
  object_digest: string;
  object_size: number;
  format: 'aesrun/v1';
  bundle_data: EncryptedRunBundle;
  created_at: string;
};
type PublishedReportRow = {
  id: string;
  owner_id: string;
  run_id: string;
  title: string;
  object_digest: string;
  object_size: number;
  report_json: AesReportV1;
  created_at: string;
  revoked_at: string | null;
};
type AccountLimitsRow = {
  owner_id: string;
  storage_limit_bytes: number;
  bundle_limit_bytes: number;
  version_limit: number;
  report_limit: number;
  daily_cloud_write_limit: number;
  daily_hosted_run_limit: number;
  created_at: string;
};
type AccountUsageRow = AccountLimitsRow & {
  storage_used_bytes: number;
  bundle_versions: number;
  published_reports: number;
  cloud_writes_today: number;
  hosted_runs_today: number;
};
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
type Database = {
  public: {
    Tables: {
      workspaces: Table<WorkspaceRow>;
      run_metadata: Table<RunMetadataRow>;
      bundle_versions: Table<BundleVersionRow>;
      published_reports: Table<PublishedReportRow>;
      account_limits: Table<AccountLimitsRow>;
    };
    Views: { my_account_usage: Table<AccountUsageRow> };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const DEFAULT_ACCOUNT_LIMITS = {
  storageBytes: 10 * 1024 * 1024,
  bundleBytes: 512 * 1024,
  reportBytes: 256 * 1024,
  versions: 100,
  reports: 20,
  dailyCloudWrites: 50,
  dailyHostedRuns: 5,
} as const;

export class NeonSignInRequiredError extends Error {
  readonly code = 'AUTH_REQUIRED';

  constructor() {
    super('Sign in with Google to continue this action.');
    this.name = 'NeonSignInRequiredError';
  }
}

export function isNeonSignInRequiredError(
  error: unknown,
): error is NeonSignInRequiredError {
  return (
    error instanceof NeonSignInRequiredError ||
    (error instanceof Error &&
      'code' in error &&
      error.code === 'AUTH_REQUIRED')
  );
}

export function getGoogleSignInHref(returnTo = '/'): string {
  const safePath =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/auth?next=${encodeURIComponent(safePath)}`;
}

export function redirectToGoogleSignIn(returnTo?: string): void {
  if (typeof window === 'undefined') return;
  const destination =
    returnTo ?? `${window.location.pathname}${window.location.search}`;
  window.location.assign(getGoogleSignInHref(destination));
}

function createNeonClient(
  authUrl: string,
  dataApiUrl: string,
  allowAnonymous: boolean,
) {
  return createClient<Database>({
    auth: { adapter: SupabaseAuthAdapter(), url: authUrl, allowAnonymous },
    dataApi: { url: dataApiUrl },
  });
}

type NeonBrowserClient = ReturnType<typeof createNeonClient>;
let privateClient: NeonBrowserClient | null | undefined;
let publicClient: NeonBrowserClient | null | undefined;

function configuration(): { authUrl: string; dataApiUrl: string } | null {
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
  return authUrl && dataApiUrl ? { authUrl, dataApiUrl } : null;
}

export function getNeon(): NeonBrowserClient | null {
  if (privateClient !== undefined) return privateClient;
  const config = configuration();
  privateClient = config
    ? createNeonClient(config.authUrl, config.dataApiUrl, false)
    : null;
  return privateClient;
}

function getPublicNeon(): NeonBrowserClient | null {
  if (publicClient !== undefined) return publicClient;
  const config = configuration();
  publicClient = config
    ? createNeonClient(config.authUrl, config.dataApiUrl, true)
    : null;
  return publicClient;
}

function sessionFrom(result: any): any {
  return result?.data?.session ?? result?.data ?? result?.session ?? null;
}

export async function getCurrentNeonUser(): Promise<{
  id: string;
  email: string | null;
  name: string | null;
} | null> {
  const neon = getNeon();
  if (!neon) return null;
  const result = (await neon.auth.getUser()) as any;
  const user = result?.data?.user ?? result?.data ?? result?.user ?? null;
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? user.user_metadata?.name ?? null,
  };
}

export async function signInWithGoogle(returnTo = '/'): Promise<void> {
  const neon = getNeon();
  if (!neon) throw new Error('Google sign-in is not configured yet.');
  const safePath =
    returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const redirectTo =
    typeof window === 'undefined'
      ? safePath
      : new URL(safePath, window.location.origin).toString();
  const result = (await neon.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })) as any;
  if (result?.error) throw result.error;
}

export async function getNeonSession(): Promise<{
  userId: string;
  accessToken: string;
}> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  const result = (await neon.auth.getSession()) as any;
  const session = sessionFrom(result);
  const userId = session?.user?.id;
  const accessToken = session?.access_token ?? session?.token;
  if (!userId || !accessToken)
    throw new NeonSignInRequiredError();
  return { userId, accessToken };
}

export async function ensureAccountLimits(): Promise<void> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  const { userId } = await getNeonSession();
  const result = await neon.from('account_limits').insert({ owner_id: userId });
  if (result.error && result.error.code !== '23505') throw result.error;
}

export async function getAccountUsage(): Promise<AccountUsageRow> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  await ensureAccountLimits();
  const result = await neon.from('my_account_usage').select('*').single();
  if (result.error || !result.data)
    throw result.error ?? new Error('Account usage is unavailable.');
  const row = result.data as AccountUsageRow;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
    ]),
  ) as AccountUsageRow;
}

export async function uploadImmutableBundle(
  bundle: EncryptedRunBundle,
  run: RunRecord,
): Promise<void> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  const { userId } = await getNeonSession();
  const keyFingerprint = await crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(bundle.wrappedKey.ciphertext))
    .then((digest) =>
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    );
  const workspace = await neon
    .from('workspaces')
    .upsert(
      {
        id: bundle.workspaceId,
        owner_id: userId,
        name: 'Personal evidence workspace',
        key_fingerprint: keyFingerprint,
        recovery_confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (workspace.error) throw workspace.error;
  const runMetadata = await neon
    .from('run_metadata')
    .upsert(
      {
        owner_id: userId,
        workspace_id: bundle.workspaceId,
        run_id: run.id,
        module: run.module,
        state: run.state,
        title: run.title,
        created_at: run.createdAt,
        updated_at: run.updatedAt,
      },
      { onConflict: 'workspace_id,run_id' },
    );
  if (runMetadata.error) throw runMetadata.error;
  const objectSize = new TextEncoder().encode(
    JSON.stringify(bundle),
  ).byteLength;
  if (objectSize > DEFAULT_ACCOUNT_LIMITS.bundleBytes)
    throw new Error(
      'This encrypted bundle is larger than the 512 KB per-version limit.',
    );
  const objectPath = `${userId}/${bundle.workspaceId}/${bundle.runId}/${bundle.payload.digest}.aesrun`;
  const metadata = await neon
    .from('bundle_versions')
    .insert({
      owner_id: userId,
      workspace_id: bundle.workspaceId,
      run_id: bundle.runId,
      object_path: objectPath,
      object_digest: bundle.payload.digest,
      object_size: objectSize,
      format: bundle.format,
      bundle_data: bundle,
    });
  if (metadata.error && metadata.error.code !== '23505') throw metadata.error;
}

export async function listCloudBundles(): Promise<
  Array<{
    workspace_id: string;
    run_id: string;
    object_digest: string;
    object_size: number;
    created_at: string;
  }>
> {
  const neon = getNeon();
  if (!neon) return [];
  await getNeonSession();
  const result = await neon
    .from('bundle_versions')
    .select('workspace_id,run_id,object_digest,object_size,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (result.error) throw result.error;
  return (result.data ?? []) as Array<{
    workspace_id: string;
    run_id: string;
    object_digest: string;
    object_size: number;
    created_at: string;
  }>;
}

export async function downloadCloudBundle(version: {
  workspace_id: string;
  run_id: string;
  object_digest: string;
}): Promise<EncryptedRunBundle> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  await getNeonSession();
  const record = await neon
    .from('bundle_versions')
    .select('bundle_data')
    .eq('workspace_id', version.workspace_id)
    .eq('run_id', version.run_id)
    .eq('object_digest', version.object_digest)
    .single();
  if (record.error || !record.data?.bundle_data)
    throw record.error ?? new Error('Encrypted bundle version was not found.');
  return record.data.bundle_data as EncryptedRunBundle;
}

export async function publishPublicReport(
  report: AesReportV1,
): Promise<string> {
  const neon = getNeon();
  if (!neon) throw new Error('Neon is not configured.');
  const { userId } = await getNeonSession();
  const bytes = new TextEncoder().encode(JSON.stringify(report));
  if (bytes.byteLength > DEFAULT_ACCOUNT_LIMITS.reportBytes)
    throw new Error('This report is larger than the 256 KB publication limit.');
  const digest = await crypto.subtle
    .digest('SHA-256', bytes)
    .then((value) =>
      [...new Uint8Array(value)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    );
  const inserted = await neon
    .from('published_reports')
    .insert({
      id: report.reportId,
      owner_id: userId,
      run_id: report.runId,
      title: report.title,
      object_digest: digest,
      object_size: bytes.byteLength,
      report_json: report,
      revoked_at: null,
    });
  if (inserted.error) throw inserted.error;
  return report.reportId;
}

export async function readPublicReport(id: string): Promise<AesReportV1> {
  const neon = getPublicNeon();
  if (!neon) throw new Error('Public report service is not configured.');
  const record = await neon
    .from('published_reports')
    .select('report_json,revoked_at')
    .eq('id', id)
    .single();
  if (record.error || !record.data || record.data.revoked_at)
    throw new Error('Report not found or revoked.');
  return record.data.report_json as AesReportV1;
}
