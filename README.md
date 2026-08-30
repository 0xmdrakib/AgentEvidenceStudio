# Agent Evidence Studio

Agent Evidence Studio is an administrator-hosted, browser-based evidence workspace. One Vercel deployment serves every member; users do not install an agent, keep a PC online, or run a localhost service.

- Live application: https://agent-evidence-studio.vercel.app
- Source repository: https://github.com/0xmdrakib/AgentEvidenceStudio

It combines three modules:

- **Flight Recorder** — immutable causal evidence timelines and evidence-only replay.
- **MemoryMerge** — typed three-way JSON merge with human conflict resolution.
- **Research Jury** — authenticated Researcher, Challenger, and Adjudicator passes with strict source-bound output.

## Hosted architecture

- Vercel serves the web application and protected Node.js execution functions.
- Neon Auth identifies members and Neon Postgres enforces owner-scoped metadata access.
- Private `.aesrun` payloads are AES-256-GCM encrypted in the member browser before upload to append-only, owner-scoped Neon rows.
- The administrator configures `OPENAI_API_KEY`, `DATABASE_URL`, and Neon Auth verification only in Vercel server environment values.
- Members never provide an executable, API key, database credential, or localhost endpoint.

Research Jury uses the OpenAI Responses API with hosted web search, strict JSON Schema output, sequential roles, at most one repair attempt per role, bounded tool calls, per-user daily limits, `store: false`, and a hashed safety identifier.

## Administrator setup

1. Create a new dedicated Neon project for Agent Evidence Studio.
2. Apply the ordered migrations in `neon/migrations/`.
3. Configure Neon Auth and the Data API.
4. Add the values documented in `.env.example` to one new Vercel project.
5. Deploy and verify sign-in, one hosted Jury run, encrypted export/sync, import, replay, merge resolution, and redacted report preview.

Do not reuse credentials or databases from unrelated projects.

## Development and validation

Requirements: Node.js 24+ and npm 11+.

```bash
npm install
npm run check
npm run test:e2e
```

`npm run dev` is only a temporary developer preview. Production members use the deployed HTTPS application and never depend on the developer machine.

`npm run test:technocore:live` targets a disposable, version-pinned local Technocore container and never writes to the public service.

## Privacy and recovery

- No chain-of-thought is requested or stored.
- Provider evidence contains role output, bounded source metadata, usage, status, and digests only.
- Public reports require a redaction preview and explicit publish action.
- GitHub, X, room ownership transfer, public Technocore rooms, and notes are outside run approval.
- Every encrypted export produces a recovery kit that must be stored offline.

See [Architecture](docs/ARCHITECTURE.md), [Recovery](docs/RECOVERY.md), [Providers](docs/PROVIDERS.md), [Evidence formats](docs/EVIDENCE_FORMATS.md), and [Neon deployment](docs/DEPLOYMENT-NEON.md).

## License

This project is licensed under the [MIT License](LICENSE).
