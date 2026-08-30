import { canonicalJson, createId, sha256 } from '@aes/core';

export const TECHNOCORE_EVENT_KINDS = ['run.started', 'role.completed', 'merge.completed', 'run.completed', 'run.failed'] as const;
export type TechnocoreEventKind = (typeof TECHNOCORE_EVENT_KINDS)[number];

export interface BoundedApprovalScope {
  roomId: string;
  controllerDid: string;
  eventKinds: TechnocoreEventKind[];
  maximumWrites: number;
  expiresAt: string;
}

export interface BoundedApproval extends BoundedApprovalScope {
  id: string;
  scopeDigest: string;
  writesUsed: number;
  revokedAt?: string;
}

export async function createBoundedApproval(scope: BoundedApprovalScope, now = new Date()): Promise<BoundedApproval> {
  if (scope.maximumWrites < 1 || scope.maximumWrites > 8) throw new Error('Technocore approval is capped at eight writes.');
  const expiry = Date.parse(scope.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now.getTime() || expiry - now.getTime() > 2 * 60 * 60 * 1_000) throw new Error('Technocore approval must expire within two hours.');
  if (!scope.roomId || !scope.controllerDid || scope.eventKinds.length === 0) throw new Error('Room, controller DID, and event kinds are required.');
  if (scope.eventKinds.some((kind) => !TECHNOCORE_EVENT_KINDS.includes(kind))) throw new Error('Approval contains an unsupported event kind.');
  const normalized = { ...scope, eventKinds: [...new Set(scope.eventKinds)].sort() };
  return { ...scope, id: createId('approval'), scopeDigest: await sha256(normalized), writesUsed: 0 };
}

export async function assertApproval(approval: BoundedApproval, request: { roomId: string; controllerDid: string; kind: TechnocoreEventKind }, now = new Date()): Promise<void> {
  if (approval.revokedAt) throw new Error('Technocore approval has been revoked.');
  if (Date.parse(approval.expiresAt) <= now.getTime()) throw new Error('Technocore approval expired.');
  if (approval.writesUsed >= approval.maximumWrites) throw new Error('Technocore write cap reached.');
  if (approval.roomId !== request.roomId || approval.controllerDid !== request.controllerDid || !approval.eventKinds.includes(request.kind)) throw new Error('Write falls outside the approved Technocore scope.');
  const digest = await sha256({ roomId: approval.roomId, controllerDid: approval.controllerDid, eventKinds: [...approval.eventKinds].sort(), maximumWrites: approval.maximumWrites, expiresAt: approval.expiresAt });
  if (digest !== approval.scopeDigest) throw new Error('Technocore approval scope changed and is no longer valid.');
}

export interface SignedSummary {
  id: string;
  roomId: string;
  controllerDid: string;
  kind: TechnocoreEventKind;
  runId: string;
  eventDigest: string;
  status: string;
  timestamp: string;
  signature: string;
}

export interface TechnocoreTransport {
  publish(summary: SignedSummary): Promise<{ state: 'acknowledged'; remoteId: string } | { state: 'unknown' }>;
  readBack(roomId: string, summaryId: string): Promise<SignedSummary | null>;
}

export async function reconcilePublish(transport: TechnocoreTransport, summary: SignedSummary): Promise<{ state: 'acknowledged'; remoteId: string } | { state: 'unknown' }> {
  const outcome = await transport.publish(summary);
  if (outcome.state === 'acknowledged') return outcome;
  const remote = await transport.readBack(summary.roomId, summary.id);
  if (remote && canonicalJson({ ...remote, signature: '' }) === canonicalJson({ ...summary, signature: '' })) return { state: 'acknowledged', remoteId: remote.id };
  return { state: 'unknown' };
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58btc(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = '1' + encoded;
  }
  return encoded || '1';
}

export function sweepTechnocoreText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/gu, ' ').trim();
}

export async function generateIdentity(): Promise<{ did: string; publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const multicodec = new Uint8Array(2 + rawPublicKey.length);
  multicodec.set([0xed, 0x01]);
  multicodec.set(rawPublicKey, 2);
  return { did: `did:key:z${base58btc(multicodec)}`, publicKey, privateKey };
}

export async function signSummary(unsigned: Omit<SignedSummary, 'signature'>, privateKey: JsonWebKey): Promise<SignedSummary> {
  const key = await crypto.subtle.importKey('jwk', privateKey, { name: 'Ed25519' }, false, ['sign']);
  const signature = await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(canonicalJson(unsigned)));
  return { ...unsigned, signature: Buffer.from(signature).toString('base64url') };
}

export async function signTechnocoreMessage(roomId: string, nonce: string, text: string, privateKey: JsonWebKey): Promise<{ text: string; signature: string }> {
  if (!/^\d{1,19}$/.test(nonce)) throw new Error('Technocore nonce must contain 1–19 digits.');
  const swept = sweepTechnocoreText(text);
  if (new TextEncoder().encode(swept).length > 4_096) throw new Error('Technocore message exceeds 4,096 UTF-8 bytes.');
  const key = await crypto.subtle.importKey('jwk', privateKey, { name: 'Ed25519' }, false, ['sign']);
  const payload = new TextEncoder().encode(`${roomId}|${nonce}|${swept}`);
  const signature = await crypto.subtle.sign('Ed25519', key, payload);
  return { text: swept, signature: Buffer.from(signature).toString('base64url') };
}

export function createTechnocoreNonce(now = Date.now()): string {
  const nonce = BigInt(now) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000));
  return nonce.toString();
}

export class TechnocoreHttpTransport implements TechnocoreTransport {
  constructor(
    private readonly origin: string,
    private readonly identity: { did: string; privateKey: JsonWebKey },
    private readonly timeoutMs = 15_000,
  ) {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1'].includes(url.hostname.replace(/^\[|\]$/g, ''))) {
      throw new Error('Live Technocore transport is restricted to an explicit loopback HTTP origin.');
    }
  }

  async publish(summary: SignedSummary): Promise<{ state: 'acknowledged'; remoteId: string } | { state: 'unknown' }> {
    const text = canonicalJson({
      schema: 'agent-evidence-summary/v1', id: summary.id, runId: summary.runId, kind: summary.kind,
      eventDigest: summary.eventDigest, status: summary.status, timestamp: summary.timestamp,
    });
    const nonce = createTechnocoreNonce();
    const signed = await signTechnocoreMessage(summary.roomId, nonce, text, this.identity.privateKey);
    const endpoint = new URL(`/r/${encodeURIComponent(summary.roomId)}/say-signed/${encodeURIComponent(this.identity.did)}/${signed.signature}/${nonce}/${encodeURIComponent(signed.text)}`, this.origin);
    try {
      const response = await fetch(endpoint, { redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs), headers: { accept: 'text/plain' } });
      if (response.status === 429) throw new Error(`Technocore rate limited the write: ${(await response.text()).slice(0, 300)}`);
      if (response.status >= 300 && response.status < 400) throw new Error('Technocore redirects are not allowed.');
      if (!response.ok) throw new Error(`Technocore write failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const receipt = await response.text();
      return { state: 'acknowledged', remoteId: receipt.match(/\d+/)?.[0] ?? summary.id };
    } catch (error) {
      if (error instanceof Error && /rate limited|redirects|HTTP/.test(error.message)) throw error;
      return { state: 'unknown' };
    }
  }

  async readBack(roomId: string, summaryId: string): Promise<SignedSummary | null> {
    const endpoint = new URL(`/r/${encodeURIComponent(roomId)}`, this.origin);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('limit', '200');
    const response = await fetch(endpoint, { redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs), headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json() as { messages?: Array<{ from?: string; text?: string }> } | Array<{ from?: string; text?: string }>;
    const messages = Array.isArray(payload) ? payload : payload.messages ?? [];
    const match = [...messages].reverse().find((message) => message.from === this.identity.did && message.text?.includes(`"id":"${summaryId}"`));
    if (!match?.text) return null;
    try {
      const parsed = JSON.parse(match.text) as { id: string; runId: string; kind: TechnocoreEventKind; eventDigest: string; status: string; timestamp: string };
      return {
        id: parsed.id, roomId, controllerDid: this.identity.did, kind: parsed.kind, runId: parsed.runId,
        eventDigest: parsed.eventDigest, status: parsed.status, timestamp: parsed.timestamp, signature: '',
      };
    } catch { return null; }
  }
}
