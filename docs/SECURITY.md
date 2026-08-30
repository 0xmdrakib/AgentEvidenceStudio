# Security

## Hosted execution

- Provider and database credentials are server-only Vercel environment values.
- Every Jury execution requires a valid Neon Auth JWT and a trusted request origin.
- The model and limits are selected by the administrator, never by the member request.
- Questions are bounded to 2,000 characters; requests are size-limited.
- Daily per-user usage is reserved atomically in Postgres before provider cost is incurred.
- OpenAI responses use `store: false`, strict structured output, bounded web search, and hashed safety identifiers.
- No hidden reasoning or chain-of-thought is stored.

## Browser encryption

- Sensitive run payloads are compressed and encrypted with AES-256-GCM before private upload.
- A random workspace key is wrapped with PBKDF2-SHA256 using 310,000 iterations.
- Distinct nonces protect key wrapping and payload encryption.
- The passphrase and unwrapped key never leave the member browser.
- Wrong passphrases, tampering, nonce reuse, and corrupt bundles fail closed.

## Neon

- All member data tables use owner-scoped RLS and explicit grants.
- Private object paths are derived from the verified JWT subject.
- Presigned object URLs expire after five minutes and enforce a 50 MiB limit.
- `execution_usage` is accessible only to the server database role.
- Public reports contain sanitized `aesreport/v1` data only and can be revoked.

## External actions

Technocore writes, GitHub, X, public reports, room ownership transfer, and public rooms require explicit separate actions. URLs and retrieved content are never treated as instructions.
