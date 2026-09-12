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

Members submit a focused question. With official DeepSeek or Vercel AI Gateway
configured, leaving source links empty starts bounded web search using that
provider's existing key. DeepSeek uses its native server-side search tool;
Gateway uses Perplexity Search. Alternatively, members can supply 1–3 public
HTTPS links and skip the search request. Other compatible model providers retain
this explicit-link mode; function-calling support alone does not supply a search engine.

Discovery returns at most three candidate URLs. The server independently reads
their HTML/text pages, selects relevant excerpts with neighbouring sentences,
computes page digests, and gives identical evidence to all three roles. Unreadable
discovered pages are excluded; a run with no readable evidence stops. This is
bounded research, not exhaustive web coverage. PDFs, authenticated pages, and
image-only sources are not supported. Search snippets or model-generated text
are never substituted for downloaded source evidence.

## AI configuration

The administrator sets these three **server-only** Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | The selected provider’s API key |
| `AI_BASE_URL` | Its OpenAI-compatible base URL, without `/chat/completions` |
| `AI_MODEL` | The exact model ID published by that provider |

For the three review roles the app appends `/chat/completions`. Official DeepSeek uses
`https://api.deepseek.com` with `deepseek-flash`; OpenAI-compatible gateways can
use their own base path and model ID. No provider choice or credential is
accepted from members. The provider must support non-streaming Chat Completions,
JSON-object output, and enforce `max_tokens`. The app validates every result
locally and does not retry provider or transport failures. It disables thinking
on the official DeepSeek endpoint and explicitly requests non-reasoning mode for
DeepSeek models on Vercel Gateway. Other gateways retain their own options.

Both search configurations use only those same three variables:

| Connection | `AI_BASE_URL` | `AI_MODEL` example | Search |
| --- | --- | --- | --- |
| Official DeepSeek | `https://api.deepseek.com` (also accepts `/v1`) | `deepseek-flash` | Native `web_search_20250305` tool, same DeepSeek key |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/v1` | `deepseek/deepseek-v4.1-flash` | Gateway Perplexity Search, same Gateway key |

For official DeepSeek only, the server sends the search call to
`https://api.deepseek.com/anthropic/v1/messages`. This is another format on the
same provider, **not** an Anthropic account or a Vercel Gateway request. The
administrator-selected model and key remain unchanged. No extra search ENV or
credential is needed. Exact base matching prevents lookalike hosts or arbitrary
third-party configurations from receiving native tools. There is no automatic
cross-provider fallback or paid retry.
See [DeepSeek native search implementation](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/web/web-search-deepseek)
and [Gateway server-tool search](https://vercel.com/docs/ai-gateway/models-and-providers/web-search.md).

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
| Each research | At most 4 model requests total, including discovery |
| Search mode | 1 search-bearing request, at most 3 candidate pages, 512 generated output tokens |
| Official DeepSeek search | Native tool `max_uses: 1`; require one matched server call/result; provider controls retrieved context |
| Gateway search | Fixed query, 3 results, 1,536 search-context tokens; require exactly 1 reported successful search |
| Researcher / Challenger / Adjudicator | Output ceilings: 1,024 / 1,024 / 1,536 tokens |
| Explicit-source mode | 3 roles plus at most 1 shared schema repair; repair ceiling 1,536 tokens |
| Each role call | 12,288 input bytes, 50 seconds; no HTTP retries |
| Entire research | 240 seconds; quota lease expires after 6 minutes |

Search settings are controlled by the server, never by request-supplied tools,
credentials, or limits. DeepSeek generates one focused query with its native
tool, capped by `max_uses: 1`. Only structured `web_search_tool_result` URLs are
accepted; prose and generated citations are ignored. The app keeps at most three
safe, distinct URLs. DeepSeek does not expose a result-count or retrieved-context
size knob, so this local truncation does not limit its internal retrieval tokens.
Gateway receives a fixed query, result count and context limit. It executes its
server tool internally; a successful result must report exactly one search call.
Missing or excessive search evidence fails closed, without another request.
These response checks detect provider overruns after the fact; they cannot undo
charges already incurred. No application tool loop or continuation is followed.
Both routes have a 50-second request timeout and a 65,536-byte response limit.
Reported input above 14,336 tokens or output above 512 stops the run before roles.
Unknown usage reserves that accounting allowance, not a guaranteed upstream cost.
Search-mode runs spend their fourth call on discovery, so they do not have a
fifth call for schema repair. The 20/day and 200/month site caps are still the
initial safety policy, not DeepSeek service limits or a promised public capacity.

Daily and monthly resets use UTC. Submitted attempts remain charged on errors,
disconnects, or process crashes. PostgreSQL serializes reservations before any
source fetch or model call; signing out, concurrent tabs, and recreating an
account with the same Google identity do not reset allocation. The ledger has no
browser read/write grants. The authenticated usage endpoint returns only the
current member’s allowance. Existing per-account administrator limits can reduce
the daily allowance further but cannot exceed the AI ceiling.

These bounds cap request and token volume, not arbitrary providers’ invoices.
The old $0.23/member-month figure was a pessimistic ceiling estimate, not a
measured bill. Cost engineering now preserves the three role passes while:

- keeping instructions and evidence in an identical prompt prefix across roles,
  allowing provider-managed prefix caching;
- keeping digests, long URLs and retrieval metadata in canonical records rather
  than retransmitting them to every role;
- using the same excerpt byte allowance for relevant passages instead of page
  introductions, without an extra summarization-model request;
- reducing the three normal role output ceilings from 4,608 to 3,584 tokens
  (22.2% lower output allowance, **not** a guaranteed 22.2% bill reduction);
- reserving actual prompt bytes plus framing when usage is missing, recording
  reported usage when available, and not retrying ambiguous paid requests.

For illustration only, a complete run consuming 6,000 uncached input tokens and
1,200 output tokens would cost $0.00324 at official DeepSeek's documented peak
rates ($0.30/M input, $1.20/M output). One Gateway Perplexity Search adds $0.005
at its documented rate, so those same token totals plus search would be $0.00824
per run, or $0.0824 for ten runs. This is **not measured production usage or a
guaranteed ceiling**; Gateway token prices, cache hits, actual outputs and search
execution change the bill. Search can cost more than inference on a cheap model.
Hosting, database, taxes and other charges are excluded. A dedicated provider key
with its own spending ceiling remains necessary for a monetary hard stop.

No cross-account result cache or persistent plaintext-question cache is added.
Provider-managed caching follows that provider's retention and isolation rules.
Tests use mocked upstream responses for both official DeepSeek and Gateway,
including their authentication, wire formats, quotas, errors and cancellation.
Real search acceptance runs for each connection are still required with the
administrator's live keys; automated tests never make paid provider calls.

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
