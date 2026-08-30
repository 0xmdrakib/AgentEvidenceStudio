import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';
import type { AesReportV1, EncryptedRunBundle, RunRecord } from '@aes/contracts';

type WorkspaceRow = { id: string; owner_id: string; name: string; key_fingerprint: string; recovery_confirmed_at: string; created_at: string };
type RunMetadataRow = { owner_id: string; workspace_id: string; run_id: string; module: RunRecord['module']; state: RunRecord['state']; title: string; created_at: string; updated_at: string };
type BundleVersionRow = { id: string; owner_id: string; workspace_id: string; run_id: string; object_path: string; object_digest: string; object_size: number; format: 'aesrun/v1'; bundle_data: EncryptedRunBundle; created_at: string };
type PublishedReportRow = { id: string; owner_id: string; run_id: string; title: string; object_digest: string; report_json: AesReportV1; created_at: string; revoked_at: string | null };
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type Database = { public: { Tables: { workspaces: Table<WorkspaceRow>; run_metadata: Table<RunMetadataRow>; bundle_versions: Table<BundleVersionRow>; published_reports: Table<PublishedReportRow> }; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } };

function createNeonClient(authUrl: string, dataApiUrl: string) {
  return createClient<Database>({ auth: { adapter: SupabaseAuthAdapter(), url: authUrl, allowAnonymous: true }, dataApi: { url: dataApiUrl } });
}

type NeonBrowserClient = ReturnType<typeof createNeonClient>;
let client: NeonBrowserClient | null | undefined;

export function getNeon(): NeonBrowserClient | null {
  if (client !== undefined) return client;
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
  client = authUrl && dataApiUrl ? createNeonClient(authUrl, dataApiUrl) : null;
  return client;
}

export async function getNeonSession(): Promise<{ userId: string; accessToken: string }> {
  const neon = getNeon(); if (!neon) throw new Error('Neon is not configured.');
  const result = await neon.auth.getSession() as any;
  const session = result?.data?.session ?? result?.data ?? result?.session;
  const userId = session?.user?.id; const accessToken = session?.access_token ?? session?.token;
  if (!userId || !accessToken) throw new Error('Sign in before accessing private cloud history.');
  return { userId, accessToken };
}

export async function uploadImmutableBundle(bundle: EncryptedRunBundle, run: RunRecord): Promise<void> {
  const neon = getNeon(); if (!neon) throw new Error('Neon is not configured.');
  const { userId } = await getNeonSession();
  const keyFingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bundle.wrappedKey.ciphertext)).then((digest) => [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  const workspace = await neon.from('workspaces').upsert({ id: bundle.workspaceId, owner_id: userId, name: 'Personal evidence workspace', key_fingerprint: keyFingerprint, recovery_confirmed_at: new Date().toISOString() }, { onConflict: 'id' });
  if (workspace.error) throw workspace.error;
  const runMetadata = await neon.from('run_metadata').upsert({ owner_id: userId, workspace_id: bundle.workspaceId, run_id: run.id, module: run.module, state: run.state, title: run.title, created_at: run.createdAt, updated_at: run.updatedAt }, { onConflict: 'workspace_id,run_id' });
  if (runMetadata.error) throw runMetadata.error;
  const objectSize = new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
  const objectPath = `${userId}/${bundle.workspaceId}/${bundle.runId}/${bundle.payload.digest}.aesrun`;
  const metadata = await neon.from('bundle_versions').insert({ owner_id: userId, workspace_id: bundle.workspaceId, run_id: bundle.runId, object_path: objectPath, object_digest: bundle.payload.digest, object_size: objectSize, format: bundle.format, bundle_data: bundle });
  if (metadata.error && metadata.error.code !== '23505') throw metadata.error;
}

export async function listCloudBundles(): Promise<Array<{ workspace_id: string; run_id: string; object_digest: string; object_size: number; created_at: string }>> {
  const neon = getNeon(); if (!neon) return [];
  const result = await neon.from('bundle_versions').select('workspace_id,run_id,object_digest,object_size,created_at').order('created_at', { ascending: false }).limit(100);
  if (result.error) throw result.error;
  return (result.data ?? []) as Array<{ workspace_id: string; run_id: string; object_digest: string; object_size: number; created_at: string }>;
}

export async function downloadCloudBundle(version: { workspace_id: string; run_id: string; object_digest: string }): Promise<EncryptedRunBundle> {
  const neon = getNeon(); if (!neon) throw new Error('Neon is not configured.');
  await getNeonSession();
  const record = await neon.from('bundle_versions').select('bundle_data').eq('workspace_id', version.workspace_id).eq('run_id', version.run_id).eq('object_digest', version.object_digest).single();
  if (record.error || !record.data?.bundle_data) throw record.error ?? new Error('Encrypted bundle version was not found.');
  return record.data.bundle_data as EncryptedRunBundle;
}

export async function publishPublicReport(report: AesReportV1): Promise<string> {
  const neon = getNeon(); if (!neon) throw new Error('Neon is not configured.');
  const { userId } = await getNeonSession(); const bytes = new TextEncoder().encode(JSON.stringify(report));
  const digest = await crypto.subtle.digest('SHA-256', bytes).then((value) => [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  const inserted = await neon.from('published_reports').insert({ id: report.reportId, owner_id: userId, run_id: report.runId, title: report.title, object_digest: digest, report_json: report, revoked_at: null });
  if (inserted.error) throw inserted.error;
  return report.reportId;
}

export async function readPublicReport(id: string): Promise<AesReportV1> {
  const neon = getNeon(); if (!neon) throw new Error('Public report service is not configured.');
  const record = await neon.from('published_reports').select('report_json,revoked_at').eq('id', id).single();
  if (record.error || !record.data || record.data.revoked_at) throw new Error('Report not found or revoked.');
  return record.data.report_json as AesReportV1;
}
