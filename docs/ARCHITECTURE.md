# Architecture

## Deployment boundary

Agent Evidence Studio is one administrator-hosted browser application. Vercel serves static assets and Node.js functions; Neon provides member authentication, Postgres metadata, row-level security, and immutable encrypted bundle versions. No member machine runs a service.

## Hosted Research Jury

`api/runner.ts` accepts only authenticated same-origin requests. The function verifies the Neon JWT, reserves one daily usage slot in Postgres, selects the administrator-controlled model, and runs Researcher, Challenger, and Adjudicator sequentially through the OpenAI Responses API.

Each role uses strict JSON Schema output, bounded hosted web search, one repair attempt, a maximum tool-call count, `store: false`, and a hashed end-user safety identifier. Source content is always untrusted data. Returned provider evidence excludes hidden reasoning.

## Browser evidence workspace

The browser owns the unlocked working set, typed MemoryMerge snapshots, conflicts, replay state, and encryption passphrase. A completed run can be compressed and AES-256-GCM encrypted before upload. Neon receives the encrypted bundle object, metadata, and explicitly published sanitized reports—not the passphrase or unwrapped workspace key.

## Neon data

Browser-facing tables use per-owner RLS. `execution_usage` is server-only and has no anonymous or authenticated Data API grants. Encrypted bundle versions are append-only Postgres rows with no update or delete grants. Published reports are separately sanitized and revocable.

## Technocore

Technocore is an optional signed-summary transport, never the source of truth. Real protocol compatibility is tested against a disposable, pinned container; no acceptance test writes to the public service.
