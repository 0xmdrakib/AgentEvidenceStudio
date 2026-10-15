import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEncryptedBundle, decryptBundleWithRecovery } from '@aes/core';
import type { EncryptedRunBundle, RunRecord } from '@aes/contracts';

const mocks = vi.hoisted(() => ({ session: vi.fn(), upload: vi.fn() }));
vi.mock('../lib/neon', () => ({
  DEFAULT_ACCOUNT_LIMITS: { bundleBytes: 512 * 1024 },
  getNeonSession: mocks.session,
  uploadImmutableBundle: mocks.upload,
  NeonSignInRequiredError: class extends Error {},
}));
import { importPrivateBundle, openPrivateBundle } from '../lib/private-bundles';

const run: RunRecord = {
  id: 'run_import',
  title: 'Private import',
  module: 'recorder',
  state: 'completed',
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
  events: [],
};
const passphrase = 'private-import-test-passphrase';
let bundle: EncryptedRunBundle;
beforeAll(async () => {
  bundle = (
    await createEncryptedBundle(
      run,
      '11111111-1111-4111-8111-111111111111',
      passphrase,
    )
  ).bundle;
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    userId: 'account-a',
    accessToken: 'fixture-token',
  });
  mocks.upload.mockResolvedValue(undefined);
});

describe('account-owned encrypted import', () => {
  it('rejects an unsigned visitor before parsing, decryption or persistence', async () => {
    mocks.session.mockRejectedValue(new Error('Sign in required'));
    await expect(importPrivateBundle(null, passphrase)).rejects.toThrow(
      'Sign in required',
    );
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('persists the original encrypted envelope for the verified owner before returning evidence', async () => {
    await expect(importPrivateBundle(bundle, passphrase)).resolves.toEqual({
      run,
      ownerId: 'account-a',
    });
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
      bundle,
      run,
      'account-a',
    );
    expect(mocks.upload.mock.calls[0][0]).not.toHaveProperty('passphrase');
    expect(JSON.stringify(mocks.upload.mock.calls[0][0])).not.toContain(
      'Private import',
    );
  });
  it('does not expose a run as imported when the account quota or save fails', async () => {
    mocks.upload.mockRejectedValue(
      new Error('Private cloud storage limit reached (10 MB).'),
    );
    await expect(importPrivateBundle(bundle, passphrase)).rejects.toThrow(
      '10 MB',
    );
  });
  it('preserves a known quota message from a plain Data API error without exposing SQL details', async () => {
    mocks.upload.mockRejectedValue({
      code: 'P0001',
      message: 'Private cloud storage limit reached (10 MB).',
      details: 'private SQL details',
    });
    await expect(importPrivateBundle(bundle, passphrase)).rejects.toThrow(
      '10 MB',
    );
    mocks.upload.mockRejectedValue({ message: 'private SQL details' });
    await expect(importPrivateBundle(bundle, passphrase)).rejects.toThrow(
      'Account evidence could not be saved',
    );
  });
  it('rejects wrong passphrases without writing account data', async () => {
    await expect(
      importPrivateBundle(bundle, 'wrong-passphrase-here'),
    ).rejects.toThrow('Incorrect passphrase');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects invalid or oversized envelopes before saving', async () => {
    for (const value of [
      null,
      { ...bundle, kdf: { ...bundle.kdf, iterations: 1 } },
      {
        ...bundle,
        payload: { ...bundle.payload, ciphertext: 'A'.repeat(512 * 1024) },
      },
    ]) {
      await expect(importPrivateBundle(value, passphrase)).rejects.toThrow();
    }
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects an envelope whose run ID was changed outside the encrypted payload', async () => {
    await expect(
      importPrivateBundle({ ...bundle, runId: 'another-run' }, passphrase),
    ).rejects.toThrow('does not match');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects an account change while decrypting before attempting persistence', async () => {
    mocks.session
      .mockResolvedValueOnce({ userId: 'account-a' })
      .mockResolvedValueOnce({ userId: 'account-a' })
      .mockResolvedValue({ userId: 'account-b' });
    await expect(importPrivateBundle(bundle, passphrase)).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('does not return unlocked evidence to an account that changed during saving', async () => {
    mocks.upload.mockImplementation(async () => {
      mocks.session.mockResolvedValue({ userId: 'account-b' });
    });
    await expect(importPrivateBundle(bundle, passphrase)).rejects.toThrow();
  });
  it('opens a saved version without uploading a duplicate', async () => {
    await expect(
      openPrivateBundle(bundle, passphrase, 'account-a'),
    ).resolves.toEqual(run);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('keeps the original workspace ID and recovery kit compatible', async () => {
    const created = await createEncryptedBundle(
      run,
      '22222222-2222-4222-8222-222222222222',
      passphrase,
    );
    await importPrivateBundle(created.bundle, passphrase);
    await expect(
      decryptBundleWithRecovery(
        mocks.upload.mock.calls[0][0],
        created.recoveryKit,
      ),
    ).resolves.toEqual(run);
  });
});
