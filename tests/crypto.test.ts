import { describe, expect, it } from 'vitest';
import type { RunRecord } from '@aes/contracts';
import { createEncryptedBundle, decryptBundle, decryptBundleWithRecovery, sha256 } from '@aes/core';

const run: RunRecord = { id: 'run_crypto', title: 'Encrypted run', module: 'jury', state: 'completed', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:01.000Z', events: [] };

function corruptCiphertext(ciphertext: string, position: 'payload' | 'tag' = 'payload'): string {
  const original = Buffer.from(ciphertext, 'base64');
  const changed = Buffer.from(original);
  const index = position === 'payload' ? 0 : changed.length - 1;
  expect(changed.length).toBeGreaterThan(16);
  // Replacing a Base64 character with "A" is a no-op when it is already A.
  // Flip a decoded bit instead, including the authentication tag case.
  changed[index] ^= 1;
  expect(changed.equals(original)).toBe(false);
  return changed.toString('base64');
}

describe('encrypted run bundles', () => {
  it('always changes the decoded ciphertext, including when its Base64 starts with A', () => {
    for (let firstByte = 0; firstByte < 256; firstByte++) {
      const original = Buffer.alloc(32);
      original[0] = firstByte;
      const changed = Buffer.from(corruptCiphertext(original.toString('base64')), 'base64');
      expect(changed[0]).toBe(firstByte ^ 1);
      expect(changed.subarray(1)).toEqual(original.subarray(1));
    }
  });

  it('round-trips with passphrase and recovery kit', async () => {
    const created = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    await expect(decryptBundle(created.bundle, 'correct horse battery staple')).resolves.toEqual(run);
    await expect(decryptBundleWithRecovery(created.bundle, created.recoveryKit)).resolves.toEqual(run);
    expect(created.bundle.payload.nonce).not.toBe(created.bundle.wrappedKey.nonce);
  });

  it('fails closed for a wrong passphrase', async () => {
    const { bundle } = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    await expect(decryptBundle(bundle, 'this passphrase is wrong')).rejects.toThrow(/Incorrect passphrase/);
  });

  it('detects digest tampering before decryption', async () => {
    const { bundle } = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    const tampered = structuredClone(bundle); tampered.payload.ciphertext = corruptCiphertext(bundle.payload.ciphertext);
    await expect(decryptBundle(tampered, 'correct horse battery staple')).rejects.toThrow(/digest mismatch/i);
  });

  it.each(['payload', 'tag'] as const)('detects authenticated %s corruption even with a recomputed digest', async (position) => {
    const { bundle } = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    const tampered = structuredClone(bundle); tampered.payload.ciphertext = corruptCiphertext(bundle.payload.ciphertext, position);
    tampered.payload.digest = await sha256(new Uint8Array(Buffer.from(tampered.payload.ciphertext, 'base64')));
    await expect(decryptBundle(tampered, 'correct horse battery staple')).rejects.toThrow(/authentication failed/i);
  });

  it('rejects a recovery kit from another workspace', async () => {
    const created = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    await expect(decryptBundleWithRecovery(created.bundle, { ...created.recoveryKit, workspaceId: 'other' })).rejects.toThrow(/another workspace/);
  });
});
