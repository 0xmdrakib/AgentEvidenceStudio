import { z } from 'zod';

export const RUN_STATES = [
  'draft',
  'awaiting_approval',
  'running',
  'blocked',
  'completed',
  'failed',
  'canceled',
] as const;

export const DELIVERY_STATES = [
  'local',
  'pending',
  'acknowledged',
  'unknown',
  'failed',
] as const;

export const RunStateSchema = z.enum(RUN_STATES);
export const DeliveryStateSchema = z.enum(DELIVERY_STATES);

export const EvidenceEventSchema = z.object({
  runId: z.string().min(1),
  eventId: z.string().min(1),
  kind: z.string().min(1),
  actor: z.string().min(1),
  parentIds: z.array(z.string()).default([]),
  timestamp: z.iso.datetime(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  deliveryState: DeliveryStateSchema,
  payload: z.unknown(),
});

export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type DeliveryState = z.infer<typeof DeliveryStateSchema>;

export const SourceRecordSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  publishedAt: z.iso.datetime().nullable(),
  retrievedAt: z.iso.datetime(),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  excerpt: z.string().max(1200),
});

export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceIds: z.array(z.string()),
});

export const VerdictSchema = z.object({
  claimId: z.string().min(1),
  status: z.enum(['supported', 'disputed', 'unresolved']),
  rationale: z.string().min(1),
  sourceIds: z.array(z.string()),
});

export const JuryResultSchema = z.object({
  question: z.string().min(1),
  briefEn: z.string().min(1),
  sources: z.array(SourceRecordSchema),
  claims: z.array(ClaimSchema),
  counterevidence: z.array(ClaimSchema),
  verdicts: z.array(VerdictSchema),
  unresolvedQuestions: z.array(z.string()),
});

export type SourceRecord = z.infer<typeof SourceRecordSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type JuryResult = z.infer<typeof JuryResultSchema>;

export const ProviderProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  adapter: z.enum(['codex', 'responses', 'chat-completions', 'command']),
  executable: z.string().optional(),
  arguments: z.array(z.string().max(1_000)).max(32).optional(),
  baseUrl: z.url().optional(),
  model: z.string().min(1),
  authReference: z.string().optional(),
  capabilities: z.object({
    structuredOutput: z.boolean(),
    usage: z.boolean(),
    cancellation: z.boolean(),
  }),
  limits: z.object({
    timeoutMs: z.number().int().min(1_000).max(600_000),
    outputBytes: z.number().int().min(1_024).max(10_000_000),
  }),
  allowLoopback: z.boolean().default(false),
});

export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

export interface RunRecord {
  id: string;
  title: string;
  module: 'recorder' | 'memory' | 'jury';
  state: RunState;
  createdAt: string;
  updatedAt: string;
  providerId?: string;
  events: EvidenceEvent[];
  juryResult?: JuryResult;
}

export interface MemorySnapshot {
  id: string;
  branch: string;
  parentDigests: string[];
  digest: string;
  createdAt: string;
  value: unknown;
}

export interface MergeConflict {
  path: string;
  reason: 'changed-both' | 'delete-vs-change' | 'restricted-field';
  base: unknown;
  left: unknown;
  right: unknown;
}

export interface MergeResult {
  status: 'merged' | 'conflict';
  value?: unknown;
  conflicts: MergeConflict[];
}

export interface AesReportV1 {
  format: 'aesreport/v1';
  reportId: string;
  runId: string;
  createdAt: string;
  title: string;
  summary: string;
  claims: Array<{
    text: string;
    status: 'supported' | 'disputed' | 'unresolved';
    citations: Array<{ title: string; url: string; publisher: string }>;
  }>;
  redactions: string[];
}

export interface EncryptedRunBundle {
  format: 'aesrun/v1';
  workspaceId: string;
  runId: string;
  createdAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  wrappedKey: { nonce: string; ciphertext: string };
  payload: { nonce: string; ciphertext: string; digest: string; compressed: true };
}
