import { describe, expect, it, vi } from 'vitest';
import type { RunRecord } from '@aes/contracts';
vi.mock('../lib/neon', () => ({
  getNeonSession: vi.fn(),
  NeonSignInRequiredError: class extends Error {},
}));
import { RunnerClient } from '../lib/runner-client';

const run = {
  id: 'run_private',
  title: 'Private',
  module: 'recorder',
  state: 'completed',
  events: [],
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
} as RunRecord;
describe('unlocked account workspace', () => {
  it('registers an imported run for replay and re-export', async () => {
    const client = new RunnerClient();
    client.setAccount('account-a');
    client.rememberRun(run, 'account-a');
    expect((await client.getRun(run.id)).run).toEqual(run);
    expect(
      (
        await client.createBundle(
          run.id,
          '11111111-1111-4111-8111-111111111111',
          'private-test-passphrase',
        )
      ).bundle.runId,
    ).toBe(run.id);
  });
  it('clears evidence and branch snapshots on sign-out or an account change', async () => {
    const client = new RunnerClient();
    client.setAccount('account-a');
    client.rememberRun(run, 'account-a');
    const { snapshot } = await client.createSnapshot('main', {});
    client.setAccount('account-b');
    expect((await client.listRuns()).runs).toEqual([]);
    await expect(client.getRun(run.id)).rejects.toThrow('not found');
    await expect(
      client.mergeMemory({
        baseDigest: snapshot.digest,
        leftDigest: snapshot.digest,
        rightDigest: snapshot.digest,
        branch: 'main',
      }),
    ).rejects.toThrow('snapshots are required');
    expect(() => client.rememberRun(run, 'account-a')).toThrow();
    client.rememberRun(run, 'account-b');
    client.setAccount(null);
    expect((await client.listRuns()).runs).toEqual([]);
  });
});
