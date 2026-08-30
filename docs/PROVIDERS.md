# Hosted provider

The production product exposes one administrator-managed Research Jury provider. Members cannot configure executables, base URLs, models, or secrets.

## OpenAI Responses API

The Vercel function uses:

- built-in hosted model selection;
- server-only `OPENAI_API_KEY`;
- `store: false`;
- hosted web search with bounded tool calls;
- strict JSON Schema output;
- sequential Researcher, Challenger, and Adjudicator roles;
- one validation-repair attempt per role;
- hashed `safety_identifier` and scoped prompt-cache keys.

The hosted model and reasoning limits are versioned with the application so deployments use one reviewed configuration.

The Flight Recorder stores role outputs, sources, provider response ID/model/status, token usage, delivery state, and cryptographic digests. It does not store hidden reasoning.
