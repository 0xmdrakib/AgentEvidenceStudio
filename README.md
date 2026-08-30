# Agent Evidence Studio

Agent Evidence Studio is a browser-based workspace for recording agent activity, resolving shared-memory conflicts, and producing source-bound multi-agent research.

**Live app:** https://agentevidencestudio.rakibhq.xyz

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
