import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptedRunBundle, RunRecord } from '@aes/contracts';

const state = vi.hoisted(() => ({
  owner: 'account-a' as string | null,
  queries: [] as any[],
  reply: null as any,
}));
vi.mock('@neondatabase/neon-js', () => ({
  SupabaseAuthAdapter: () => ({}),
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: state.owner
            ? { user: { id: state.owner }, access_token: 'fixture-token' }
            : null,
        },
      }),
    },
    from: (table: string) => {
      const query = {
        table,
        action: 'select',
        filters: [] as any[],
        fields: '',
        data: null as any,
      };
      state.queries.push(query);
      const chain: any = {
        select: (fields: string) => {
          query.fields = fields;
          return chain;
        },
        insert: (data: unknown) => {
          query.action = 'insert';
          query.data = data;
          return chain;
        },
        eq: (key: string, value: unknown) => {
          query.filters.push([key, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        single: () => chain,
        maybeSingle: () => chain,
        // oxlint-disable-next-line unicorn/no-thenable -- PostgREST builders are awaitable.
        then: (resolve: any, reject: any) =>
          Promise.resolve(state.reply(query)).then(resolve, reject),
      };
      return chain;
    },
  }),
}));
import {
  downloadCloudBundle,
  listCloudBundles,
  uploadImmutableBundle,
} from '../lib/neon';

const workspace = '11111111-1111-4111-8111-111111111111';
const originalWorkspace = '22222222-2222-4222-8222-222222222222';
const bundle = {
  format: 'aesrun/v1',
  workspaceId: originalWorkspace,
  runId: 'run_saved',
  wrappedKey: { ciphertext: 'encrypted-key' },
  payload: { digest: 'a'.repeat(64), ciphertext: 'encrypted-payload' },
} as EncryptedRunBundle;
const run = {
  id: 'run_saved',
  title: 'Saved evidence',
  module: 'recorder',
  state: 'completed',
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
  events: [],
} as RunRecord;
const version = {
  workspace_id: workspace,
  run_id: run.id,
  object_digest: bundle.payload.digest,
};

beforeEach(() => {
  state.owner = 'account-a';
  state.queries = [];
  vi.stubEnv('NEXT_PUBLIC_NEON_AUTH_URL', 'https://fixture-auth.example');
  vi.stubEnv('NEXT_PUBLIC_NEON_DATA_API_URL', 'https://fixture-data.example');
  state.reply = (query: any) => ({
    error: null,
    data: query.table === 'workspaces' ? { id: workspace } : null,
  });
});

describe('private account bundle queries', () => {
  it('requires a session before querying private storage', async () => {
    state.owner = null;
    await expect(uploadImmutableBundle(bundle, run)).rejects.toThrow('Sign in');
    await expect(listCloudBundles()).rejects.toThrow('Sign in');
    await expect(downloadCloudBundle(version)).rejects.toThrow('Sign in');
    expect(state.queries).toHaveLength(0);
  });
  it('does not write when an identical encrypted payload is already stored', async () => {
    state.reply = () => ({ data: { id: 'existing-version' }, error: null });
    await uploadImmutableBundle(bundle, run, 'account-a');
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].action).toBe('select');
    expect(state.queries[0].filters).toContainEqual(['owner_id', 'account-a']);
  });
  it('stores in the account workspace while preserving the original encrypted envelope', async () => {
    await uploadImmutableBundle(bundle, run, 'account-a');
    const saved = state.queries.find(
      (query) => query.table === 'bundle_versions' && query.action === 'insert',
    );
    expect(saved.data.owner_id).toBe('account-a');
    expect(saved.data.workspace_id).toBe(workspace);
    expect(saved.data.bundle_data).toEqual(bundle);
    expect(saved.data.bundle_data.workspaceId).toBe(originalWorkspace);
    expect(
      state.queries
        .filter((query) => query.action === 'insert')
        .map((query) => query.table),
    ).toEqual(['run_metadata', 'bundle_versions']);
  });
  it('rejects a changed account before any database query', async () => {
    await expect(
      uploadImmutableBundle(bundle, run, 'account-b'),
    ).rejects.toThrow('Sign in');
    expect(state.queries).toHaveLength(0);
  });
  it('stops a save if the account changes during the first database read', async () => {
    state.reply = () => {
      state.owner = 'account-b';
      return { data: null, error: null };
    };
    await expect(
      uploadImmutableBundle(bundle, run, 'account-a'),
    ).rejects.toThrow('Sign in');
    expect(state.queries.every((query) => query.action === 'select')).toBe(
      true,
    );
  });
  it('propagates the database quota refusal instead of reporting a successful save', async () => {
    state.reply = (query: any) => ({
      data: query.table === 'workspaces' ? { id: workspace } : null,
      error:
        query.table === 'bundle_versions' && query.action === 'insert'
          ? new Error('10 MB limit reached')
          : null,
    });
    await expect(uploadImmutableBundle(bundle, run)).rejects.toThrow('10 MB');
  });
  it('reads only metadata for the account list and explicitly scopes the encrypted download', async () => {
    state.reply = (query: any) => ({
      error: null,
      data:
        query.fields === 'bundle_data'
          ? { bundle_data: bundle }
          : [
              {
                ...version,
                object_size: '1024',
                created_at: run.createdAt,
                run_metadata: { title: run.title },
              },
            ],
    });
    expect((await listCloudBundles())[0]).toMatchObject({
      title: run.title,
      object_size: 1024,
    });
    await expect(downloadCloudBundle(version)).resolves.toEqual(bundle);
    expect(
      state.queries.every((query) =>
        query.filters.some(
          ([key, value]: any[]) => key === 'owner_id' && value === 'account-a',
        ),
      ),
    ).toBe(true);
    expect(state.queries[0].fields).not.toContain('bundle_data');
    expect(state.queries[1].filters).toContainEqual([
      'object_digest',
      bundle.payload.digest,
    ]);
  });
  it('does not return another account’s in-flight list response after a switch', async () => {
    state.reply = () => {
      state.owner = 'account-b';
      return { data: [], error: null };
    };
    await expect(listCloudBundles()).rejects.toThrow('Sign in');
  });
});
