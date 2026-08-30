import { describe, expect, it } from 'vitest';
import type { RunRecord } from '@aes/contracts';
import { createEncryptedBundle, decryptBundle, decryptBundleWithRecovery, sha256 } from '@aes/core';

const run: RunRecord = { id: 'run_crypto', title: 'Encrypted run', module: 'jury', state: 'completed', createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:01.000Z', events: [] };

describe('encrypted run bundles', () => {
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
    const tampered = structuredClone(bundle); tampered.payload.ciphertext = `${tampered.payload.ciphertext.slice(0, -2)}AA`;
    await expect(decryptBundle(tampered, 'correct horse battery staple')).rejects.toThrow(/digest mismatch/i);
  });

  it('detects authenticated-ciphertext corruption even with a recomputed digest', async () => {
    const { bundle } = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    const tampered = structuredClone(bundle); tampered.payload.ciphertext = `A${tampered.payload.ciphertext.slice(1)}`;
    tampered.payload.digest = await sha256(new Uint8Array(Buffer.from(tampered.payload.ciphertext, 'base64')));
    await expect(decryptBundle(tampered, 'correct horse battery staple')).rejects.toThrow(/authentication failed/i);
  });

  it('rejects a recovery kit from another workspace', async () => {
    const created = await createEncryptedBundle(run, '11111111-1111-4111-8111-111111111111', 'correct horse battery staple');
    await expect(decryptBundleWithRecovery(created.bundle, { ...created.recoveryKit, workspaceId: 'other' })).rejects.toThrow(/another workspace/);
  });
});
