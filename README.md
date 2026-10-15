# Agent Evidence Studio

A browser-based workspace for replayable agent evidence, conflict-safe memory, and source-bound multi-agent research.

**Live app:** https://agentevidence.rakibhq.xyz

---

## Overview

Agent Evidence Studio helps you understand what an agent did, resolve competing memory changes, and review research against its sources.

It brings three workflows into one workspace: **Flight Recorder**, **MemoryMerge**, and **Research Jury**. Browse the studio freely, then sign in with Google to save evidence to your account or start hosted research.

Use it from your browser, with no local server or user-managed infrastructure required.

## Features

- Replayable timelines for agent activity and handoffs
- Event filters, causal graphs, and delivery-gap detection
- Three-way JSON merges with human-controlled conflict resolution
- Source-linked claims, counterevidence, and research verdicts
- Bounded web search or research from your own public source links
- Encrypted evidence imports and exports
- Saved run history accessible from your account
- Redaction previews before publishing public reports
- Google sign-in with account-specific storage and research allowances
- Responsive layouts for phones, tablets, and desktops

## Core modules

### Flight Recorder

Follow agent activity through a causal timeline, inspect individual events, and replay stored evidence without running the original actions again.

### MemoryMerge

Compare a base snapshot with two branches. Compatible changes merge automatically; competing or sensitive changes wait for a human decision before the canonical memory advances.

### Research Jury

Three roles review the same evidence:

- **Researcher:** Builds source-linked claims.
- **Challenger:** Looks for contradictions, stale information, and missing proof.
- **Adjudicator:** Marks findings as supported, disputed, or unresolved.

Research can begin with bounded web search or supplied public source links. Verdicts stay tied to the available evidence rather than agent agreement alone.

## Tech stack

- React 19
- TypeScript
- Vinext and Vite
- Tailwind CSS
- Neon Auth and Postgres
- Vercel
- Vitest and Playwright

---

## License

This project is licensed under the [MIT License](./LICENSE).
