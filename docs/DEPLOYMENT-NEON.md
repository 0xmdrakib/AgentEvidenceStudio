# Neon and Vercel deployment

Create new dedicated resources named for Agent Evidence Studio. Do not attach an unrelated Neon or Vercel project.

## Neon

1. Create a new Neon project.
2. Apply the ordered SQL files in `neon/migrations/` to its production branch.
3. Enable Neon Auth and the Data API.
4. Record the Auth URL, Data API URL, JWKS URL, issuer, and pooled `DATABASE_URL`.
5. Keep `bundle_versions` append-only: payloads are encrypted in the browser and stored as owner-scoped JSONB without update or delete grants.

## Vercel

Create a new project from this repository and configure:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_NEON_AUTH_URL`
- `NEXT_PUBLIC_NEON_DATA_API_URL`
- `NEON_AUTH_JWKS_URL`
- `NEON_AUTH_ISSUER`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_REASONING_EFFORT`
- `OPENAI_DAILY_RUN_LIMIT`

Only the three `NEXT_PUBLIC_*` values may be exposed to browser bundles. All other values are server secrets.

Deploy a preview, verify authentication and one encrypted workflow, then promote the exact validated source to production.
