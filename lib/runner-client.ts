import type {
  EncryptedRunBundle,
  MemorySnapshot,
  MergeConflict,
  ProviderProfile,
  RunRecord,
} from '@aes/contracts';
import {
  applyConflictResolution,
  createEncryptedBundle,
  createId,
  sha256,
  threeWayMerge,
} from '@aes/core';
import { getNeonSession, NeonSignInRequiredError } from './neon';

type StoredConflict = {
  id: string;
  baseDigest: string;
  leftDigest: string;
  rightDigest: string;
  conflicts: MergeConflict[];
  candidate: unknown;
  createdAt: string;
};

export class RunnerClient {
  private runs: RunRecord[] = [];
  private snapshots = new Map<string, MemorySnapshot>();
  private conflicts: StoredConflict[] = [];
  private configured = false;

  constructor(public readonly baseUrl = '/api/runner') {}

  async health() {
    const response = await fetch(this.baseUrl, { cache: 'no-store' });
    const data = (await response.json()) as {
      status: string;
      mode: string;
      configured: boolean;
      model: string;
      error?: string;
    };
    if (!response.ok)
      throw new Error(data.error ?? 'Hosted execution status is unavailable.');
    this.configured = data.configured;
    return { ...data, vaultUnlocked: false };
  }

  async listRuns() {
    return { runs: [...this.runs] };
  }
  async getRun(id: string) {
    const run = this.runs.find((item) => item.id === id);
    if (!run)
      throw new Error(
        'Run not found in the current unlocked browser workspace.',
      );
    return { run, graph: null };
  }
  async listProviders() {
    if (!this.configured) await this.health().catch(() => undefined);
    const providers: ProviderProfile[] = this.configured
      ? [
          {
            id: 'provider_hosted_responses',
            name: 'Hosted Research Jury',
            adapter: 'responses',
            baseUrl: 'https://api.openai.com',
            model: 'Admin managed',
            capabilities: {
              structuredOutput: true,
              usage: true,
              cancellation: true,
            },
            limits: { timeoutMs: 300_000, outputBytes: 1_000_000 },
            allowLoopback: false,
          },
        ]
      : [];
    return { providers };
  }
  async saveProvider(_profile: ProviderProfile): Promise<never> {
    throw new Error('Providers are managed by the deployment administrator.');
  }

  async runJury(question: string, providerId: string) {
    if (providerId !== 'provider_hosted_responses')
      throw new Error('Select the hosted Research Jury provider.');
    const e2eBypass =
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_E2E_MODE === '1';
    const accessToken = e2eBypass
      ? 'e2e-test-token'
      : (await getNeonSession()).accessToken;
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'jury.run', question }),
    });
    const data = (await response.json()) as { run?: RunRecord; error?: string };
    if (response.status === 401) throw new NeonSignInRequiredError();
    if (!response.ok || !data.run)
      throw new Error(data.error ?? 'Hosted Research Jury failed.');
    this.runs = [
      data.run,
      ...this.runs.filter((item) => item.id !== data.run!.id),
    ];
    return { run: data.run };
  }

  async listConflicts() {
    return { conflicts: [...this.conflicts] };
  }
  async createSnapshot(
    branch: string,
    value: unknown,
    parentDigests: string[] = [],
    _canonical = false,
  ) {
    const snapshot: MemorySnapshot = {
      id: createId('snapshot'),
      branch,
      parentDigests,
      digest: await sha256(value),
      createdAt: new Date().toISOString(),
      value,
    };
    this.snapshots.set(snapshot.digest, snapshot);
    return { snapshot };
  }
  async mergeMemory(input: {
    baseDigest: string;
    leftDigest: string;
    rightDigest: string;
    branch: string;
  }) {
    const base = this.snapshots.get(input.baseDigest);
    const left = this.snapshots.get(input.leftDigest);
    const right = this.snapshots.get(input.rightDigest);
    if (!base || !left || !right)
      throw new Error('Base, left, and right snapshots are required.');
    const result = threeWayMerge(base.value, left.value, right.value);
    if (result.status === 'conflict') {
      const conflict: StoredConflict = {
        id: createId('conflict'),
        baseDigest: base.digest,
        leftDigest: left.digest,
        rightDigest: right.digest,
        conflicts: result.conflicts,
        candidate: result.value ?? {},
        createdAt: new Date().toISOString(),
      };
      this.conflicts = [conflict, ...this.conflicts];
      throw new Error('Competing changes require a human resolution.');
    }
    return this.createSnapshot(
      input.branch,
      result.value,
      [left.digest, right.digest],
      true,
    );
  }
  async resolveConflict(
    id: string,
    resolutions: Record<string, unknown>,
    branch = 'main',
  ) {
    const conflict = this.conflicts.find((item) => item.id === id);
    if (!conflict) throw new Error('Open conflict not found.');
    const normalized: Record<
      string,
      { choice: 'base' | 'left' | 'right' | 'custom'; custom?: unknown }
    > = {};
    for (const [path, resolution] of Object.entries(resolutions)) {
      if (
        !resolution ||
        typeof resolution !== 'object' ||
        !('choice' in resolution) ||
        !['base', 'left', 'right', 'custom'].includes(String(resolution.choice))
      )
        throw new Error(`Invalid resolution for ${path}.`);
      normalized[path] = {
        choice: String(resolution.choice) as
          | 'base'
          | 'left'
          | 'right'
          | 'custom',
        ...('custom' in resolution ? { custom: resolution.custom } : {}),
      };
    }
    const value = applyConflictResolution(
      conflict.candidate,
      conflict.conflicts,
      normalized,
    );
    const result = await this.createSnapshot(
      branch,
      value,
      [conflict.leftDigest, conflict.rightDigest],
      true,
    );
    this.conflicts = this.conflicts.filter((item) => item.id !== id);
    return result;
  }
  async createApproval(scope: any) {
    if (
      !scope.roomId ||
      !scope.controllerDid ||
      scope.maximumWrites < 1 ||
      scope.maximumWrites > 8
    )
      throw new Error('A valid bounded scope is required.');
    const approval = {
      ...scope,
      id: createId('approval'),
      writesUsed: 0,
      scopeDigest: await sha256({
        ...scope,
        eventKinds: [...scope.eventKinds].sort((left: string, right: string) =>
          left.localeCompare(right),
        ),
      }),
    };
    return { approval };
  }
  async createBundle(
    runId: string,
    workspaceId: string,
    passphrase: string,
  ): Promise<{ bundle: EncryptedRunBundle; recoveryKit: unknown }> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) throw new Error('Run not found.');
    return createEncryptedBundle(run, workspaceId, passphrase);
  }
}
