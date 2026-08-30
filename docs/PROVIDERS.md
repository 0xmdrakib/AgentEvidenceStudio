# Hosted provider

The production product exposes one administrator-managed Research Jury provider. Members cannot configure executables, base URLs, models, or secrets.

## OpenAI Responses API

The Vercel function uses:

- administrator-selected `OPENAI_MODEL`;
- server-only `OPENAI_API_KEY`;
- `store: false`;
- hosted web search with bounded tool calls;
- strict JSON Schema output;
- sequential Researcher, Challenger, and Adjudicator roles;
- one validation-repair attempt per role;
- hashed `safety_identifier` and scoped prompt-cache keys.

The default model in `.env.example` is `gpt-5.6-sol`. Change it only in the administrator environment after verifying account access and cost.

The Flight Recorder stores role outputs, sources, provider response ID/model/status, token usage, delivery state, and cryptographic digests. It does not store hidden reasoning.
