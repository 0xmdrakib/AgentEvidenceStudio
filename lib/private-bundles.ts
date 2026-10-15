import { z } from 'zod';
import {
  EvidenceEventSchema,
  JuryResultSchema,
  RunStateSchema,
  type EncryptedRunBundle,
  type RunRecord,
} from '@aes/contracts';
import { decryptBundle } from '@aes/core';
import {
  DEFAULT_ACCOUNT_LIMITS,
  getNeonSession,
  NeonSignInRequiredError,
  uploadImmutableBundle,
} from './neon';

const base64 = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const envelope = z
  .object({
    format: z.literal('aesrun/v1'),
    workspaceId: z.uuid(),
    runId: z.string().min(1).max(160),
    createdAt: z.iso.datetime(),
    kdf: z
      .object({
        name: z.literal('PBKDF2-SHA256'),
        iterations: z.literal(310_000),
        salt: base64.length(24),
      })
      .strict(),
    wrappedKey: z
      .object({ nonce: base64.length(16), ciphertext: base64.length(64) })
      .strict(),
    payload: z
      .object({
        nonce: base64.length(16),
        ciphertext: base64,
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        compressed: z.literal(true),
      })
      .strict(),
  })
  .strict();

const runSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  module: z.enum(['recorder', 'memory', 'jury']),
  state: RunStateSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  providerId: z.string().optional(),
  events: z.array(EvidenceEventSchema).max(10_000),
  juryResult: JuryResultSchema.optional(),
});

export function privateBundleError(caught: unknown): Error {
  if (caught instanceof Error) return caught;
  const detail =
    caught && typeof caught === 'object' && 'message' in caught
      ? String(caught.message)
      : '';
  const quotaMessages = [
    'Private cloud storage limit reached (10 MB).',
    'Encrypted version limit reached (100).',
    'Daily cloud write limit reached.',
    'Stored run limit reached (200).',
    'Workspace limit reached (3).',
    'Encrypted bundle exceeds the 512 KB per-version limit.',
  ];
  if (quotaMessages.includes(detail)) return new Error(detail);
  return new Error(
    'Account evidence could not be saved or opened. Please retry.',
  );
}

export async function assertBundleAccount(ownerId: string): Promise<void> {
  if ((await getNeonSession()).userId !== ownerId)
    throw new NeonSignInRequiredError();
}

export function validatePrivateBundle(value: unknown): EncryptedRunBundle {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    DEFAULT_ACCOUNT_LIMITS.bundleBytes
  )
    throw new Error(
      'This encrypted bundle exceeds the 512 KB per-version limit.',
    );
  const parsed = envelope.safeParse(value);
  if (!parsed.success)
    throw new Error('Choose a valid encrypted .aesrun/v1 bundle.');
  return parsed.data;
}

export async function openPrivateBundle(
  value: unknown,
  passphrase: string,
  ownerId: string,
): Promise<RunRecord> {
  await assertBundleAccount(ownerId);
  const bundle = validatePrivateBundle(value);
  const parsed = runSchema.safeParse(await decryptBundle(bundle, passphrase));
  if (
    !parsed.success ||
    parsed.data.id !== bundle.runId ||
    parsed.data.events.some((event) => event.runId !== bundle.runId)
  )
    throw new Error('The encrypted evidence does not match this bundle.');
  await assertBundleAccount(ownerId);
  return parsed.data;
}

export async function importPrivateBundle(value: unknown, passphrase: string) {
  // Check identity before decrypting, then save before exposing the run in memory.
  const { userId } = await getNeonSession();
  const bundle = validatePrivateBundle(value);
  const run = await openPrivateBundle(bundle, passphrase, userId);
  await uploadImmutableBundle(bundle, run, userId).catch((caught: unknown) => {
    throw privateBundleError(caught);
  });
  await assertBundleAccount(userId);
  return { run, ownerId: userId };
}
