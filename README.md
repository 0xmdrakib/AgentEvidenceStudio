# Agent Evidence Studio

Agent Evidence Studio is a browser-based workspace for recording agent activity, resolving shared-memory conflicts, and producing source-bound multi-agent research.

**Live app:** https://agentevidence.rakibhq.xyz

---

## Overview

Agent Evidence Studio combines three connected workflows:

- **Flight Recorder:** Captures causal events, role outputs, sources, handoffs, approvals, delivery states, and usage evidence in a replayable timeline.
- **MemoryMerge:** Performs typed three-way JSON merges and pauses unsafe or competing changes for a human decision.
- **Research Jury:** Runs Researcher, Challenger, and Adjudicator roles to separate supported, disputed, and unresolved claims.

One administrator-hosted deployment serves every member. Users work entirely in the browser without installing a runner, hosting a local service, keeping a PC online, or providing infrastructure credentials.

## Features

- Causal run timelines with event details, actor filters, delivery states, and evidence-only replay
- Detection for orphan events, missing acknowledgements, cycles, conflicting results, transport gaps, and unknown writes
- Typed JSON snapshots with parent digests, branch heads, deterministic merge rules, and human conflict resolution
- Source-linked claims, counterevidence, bounded excerpts, verdicts, and unresolved research questions
- AES-256-GCM encrypted `.aesrun` export, import, and append-only private cloud history
- Redacted `aesreport/v1` public reports with explicit publication controls
- Google-only Neon authentication and owner-scoped Postgres access
- Database-enforced 10 MB storage, record-count, write-rate, and hosted-run quotas per member
- Responsive desktop, tablet, and mobile interface with keyboard and reduced-motion support

## Core modules

### Flight Recorder

- Stores immutable evidence events with actor, parent, timestamp, digest, delivery state, and redacted payload metadata.
- Shows the causal timeline and graph without exposing hidden chain-of-thought.
- Replays stored evidence step by step without executing an agent, tool, or network action again.

### MemoryMerge

- Automatically merges identical changes and disjoint object updates.
- Flags competing scalar or array edits, delete-versus-change cases, credentials, executable code, instructions, and financial values.
- Prevents a new canonical head until a person selects the base, left, right, or a validated custom value.

### Research Jury

- The **Researcher** creates claims that are bound to source records.
- The **Challenger** searches for contradictions, stale information, and missing evidence.
- The **Adjudicator** assigns supported, disputed, or unresolved verdicts; agent agreement alone is never treated as proof.

Members submit a focused question and 1–3 public HTTPS source links. The server
reads bounded HTML/text excerpts, computes their digests, and gives the same
evidence to all three roles. This is a source-review workflow, not an automatic
web search. PDFs, authenticated pages, and image-only sources are not supported.

## AI configuration

The administrator sets these three **server-only** Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | The selected provider’s API key |
| `AI_BASE_URL` | Its OpenAI-compatible base URL, without `/chat/completions` |
| `AI_MODEL` | The exact model ID published by that provider |

The app appends `/chat/completions`. Official DeepSeek uses
`https://api.deepseek.com` with `deepseek-flash`; OpenAI-compatible gateways can
use their own base path and model ID. No provider choice or credential is
accepted from members. The provider must support non-streaming Chat Completions,
JSON-object output, and enforce `max_tokens`. The app validates every result
locally and does not retry provider or transport failures. It disables thinking
on the official DeepSeek endpoint; gateway defaults can differ.

As of September 12, 2026, DeepSeek’s official API routes the retired
`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` IDs to V4.1 Flash.
Third-party model IDs and availability are provider-specific. See
[DeepSeek models and pricing](https://api-docs.deepseek.com/quick_start/pricing/).
Choosing a vision-capable model does not enable image uploads in this text-source workflow.

Keep every value in `.env.example` blank. Configure live values in Vercel and
redeploy. Apply `neon/migrations/0004_bounded_ai_execution.sql` after the existing
three migrations before enabling research. Missing configuration or unavailable
quota storage prevents any provider call. `OPENAI_API_KEY` is no longer used.

### Research allowance

| Scope | Enforced limit |
| --- | --- |
| Each verified Google account | 2 attempts/day, 10/calendar month |
| Simultaneous work | 1 active run/member, 3 across the site |
| Cooldown | 60 seconds/member; identical requests blocked for 10 minutes |
| Entire site | 20 attempts/day, 200/calendar month |
| Each research | 3 roles, at most 1 shared schema repair: 4 calls total |
| Each model call | 12,288 input bytes, 1,536 maximum output tokens, 50 seconds |
| Entire research | 240 seconds; quota lease expires after 6 minutes |

Daily and monthly resets use UTC. Submitted attempts remain charged on errors,
disconnects, or process crashes. PostgreSQL serializes reservations before any
source fetch or model call; signing out, concurrent tabs, and recreating an
account with the same Google identity do not reset allocation. The ledger has no
browser read/write grants. The authenticated usage endpoint returns only the
current member’s allowance. Existing per-account administrator limits can reduce
the daily allowance further but cannot exceed the AI ceiling.

These bounds cap request and token volume, not arbitrary providers’ invoices.
At DeepSeek’s documented peak prices ($0.30/M uncached input and $1.20/M output),
a conservative byte-as-token estimate plus framing reserve is approximately
$0.023/run, $0.23/member-month, and $4.55/site-month at the maximum allowed
volume; ordinary short runs can cost less. This excludes hosting, database,
taxes, and any gateway surcharge. Provider prices may change; use a dedicated
provider key/account with its own spending ceiling for a monetary hard stop.

JWT verification, verified Google identity, trusted-origin checks, strict input
schemas, idempotency, and database quotas protect research. Source fetching pins
validated public IPs and bounds redirects, time, and response size. The endpoint
does not accept arbitrary chat messages, tool calls, model settings, or provider
URLs. Origin checks alone cannot prevent a signed-in person from scripting
requests; the same hard allocations still apply. Model output is untrusted and
cannot execute account actions. Never treat AI verdicts as infallible proof.

## Hosted architecture

- Vercel serves the browser application and protected server functions.
- Neon Auth identifies members and Neon Postgres enforces owner-scoped access.
- Every member receives the same administrator-controlled 10 MB plan; database triggers prevent clients from bypassing storage and activity caps.
- Sensitive run bundles are encrypted in the browser before private cloud storage.
- Provider and database credentials remain server-side; members never supply executables, API keys, database passwords, or localhost endpoints.

## Tech stack

- React 19
- TypeScript
- Vinext and Vite
- Tailwind CSS
- Vercel
- Neon Auth and Postgres
- Vitest and Playwright

---

## License

This project is licensed under the [MIT License](./LICENSE).
