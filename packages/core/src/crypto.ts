import type { EncryptedRunBundle, RunRecord } from '@aes/contracts';
import { sha256 } from './canonical.ts';

const KDF_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (passphrase.length < 12) throw new Error('Use a passphrase with at least 12 characters.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bufferSource(salt), iterations: KDF_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface RecoveryKit {
  format: 'aes-recovery/v1';
  workspaceId: string;
  workspaceKey: string;
  createdAt: string;
}

export interface BundleCreation {
  bundle: EncryptedRunBundle;
  recoveryKit: RecoveryKit;
}

export async function createEncryptedBundle(run: RunRecord, workspaceId: string, passphrase: string, existingWorkspaceKey?: Uint8Array): Promise<BundleCreation> {
  const workspaceKey = existingWorkspaceKey ?? crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapNonce = crypto.getRandomValues(new Uint8Array(12));
  const payloadNonce = crypto.getRandomValues(new Uint8Array(12));
  if (toBase64(wrapNonce) === toBase64(payloadNonce)) throw new Error('Nonce reuse detected.');

  const wrappingKey = await deriveKey(passphrase, salt);
  const importedWorkspaceKey = await crypto.subtle.importKey('raw', bufferSource(workspaceKey), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const wrappedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferSource(wrapNonce) }, wrappingKey, bufferSource(workspaceKey));
  const compressed = await gzip(encoder.encode(JSON.stringify(run)));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferSource(payloadNonce) }, importedWorkspaceKey, bufferSource(compressed));

  return {
    bundle: {
      format: 'aesrun/v1',
      workspaceId,
      runId: run.id,
      createdAt: new Date().toISOString(),
      kdf: { name: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
      wrappedKey: { nonce: toBase64(wrapNonce), ciphertext: toBase64(new Uint8Array(wrappedKey)) },
      payload: {
        nonce: toBase64(payloadNonce),
        ciphertext: toBase64(new Uint8Array(ciphertext)),
        digest: await sha256(new Uint8Array(ciphertext)),
        compressed: true,
      },
    },
    recoveryKit: { format: 'aes-recovery/v1', workspaceId, workspaceKey: toBase64(workspaceKey), createdAt: new Date().toISOString() },
  };
}

export async function decryptBundle(bundle: EncryptedRunBundle, passphrase: string): Promise<RunRecord> {
  if (bundle.format !== 'aesrun/v1') throw new Error('Unsupported bundle format.');
  const ciphertext = fromBase64(bundle.payload.ciphertext);
  if ((await sha256(ciphertext)) !== bundle.payload.digest) throw new Error('Bundle digest mismatch. The file was corrupted or tampered with.');
  const wrappingKey = await deriveKey(passphrase, fromBase64(bundle.kdf.salt));
  let workspaceKey: ArrayBuffer;
  try {
    workspaceKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bufferSource(fromBase64(bundle.wrappedKey.nonce)) },
      wrappingKey,
      bufferSource(fromBase64(bundle.wrappedKey.ciphertext)),
    );
  } catch {
    throw new Error('Incorrect passphrase or damaged recovery metadata.');
  }
  try {
    const key = await crypto.subtle.importKey('raw', workspaceKey, 'AES-GCM', false, ['decrypt']);
    const compressed = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bufferSource(fromBase64(bundle.payload.nonce)) },
      key,
      bufferSource(ciphertext),
    );
    return JSON.parse(decoder.decode(await gunzip(new Uint8Array(compressed)))) as RunRecord;
  } catch {
    throw new Error('Bundle authentication failed. The encrypted payload may have been changed.');
  }
}

export async function decryptBundleWithRecovery(bundle: EncryptedRunBundle, recoveryKit: RecoveryKit): Promise<RunRecord> {
  if (recoveryKit.workspaceId !== bundle.workspaceId) throw new Error('Recovery kit belongs to another workspace.');
  const ciphertext = fromBase64(bundle.payload.ciphertext);
  if ((await sha256(ciphertext)) !== bundle.payload.digest) throw new Error('Bundle digest mismatch.');
  const key = await crypto.subtle.importKey('raw', bufferSource(fromBase64(recoveryKit.workspaceKey)), 'AES-GCM', false, ['decrypt']);
  const compressed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferSource(fromBase64(bundle.payload.nonce)) }, key, bufferSource(ciphertext));
  return JSON.parse(decoder.decode(await gunzip(new Uint8Array(compressed)))) as RunRecord;
}
