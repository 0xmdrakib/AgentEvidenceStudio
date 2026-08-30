# Recovery and encrypted sync

## Bundle format

`.aesrun` uses `aesrun/v1`:

1. a random 256-bit workspace key encrypts gzip-compressed run JSON with AES-256-GCM;
2. PBKDF2-SHA256 derives a wrapping key from the passphrase and a random salt;
3. a distinct 96-bit nonce wraps the workspace key with AES-256-GCM;
4. the ciphertext SHA-256 digest identifies the immutable version.

Nonce reuse is rejected during bundle construction. Authentication failure, digest mismatch, corrupted compression, and unsupported versions fail closed.

## Recovery gate

The export flow downloads the recovery kit before presenting encrypted cloud sync. The kit contains the workspace identifier and raw workspace key; it must be stored offline, separately from the `.aesrun` bundle. The passphrase is not stored in either file.

Recovery succeeds with either:

- the original passphrase, which unwraps the workspace key; or
- the matching recovery kit, which provides that key directly.

If both the passphrase and recovery kit are lost, Neon and Vercel cannot decrypt the bundle. There is intentionally no server-side recovery bypass.

## Safe test

Before relying on cloud history, export one small run, disconnect from the network, and verify an import with the passphrase. Then verify the same bundle using a copy of the recovery kit in a separate test profile.
