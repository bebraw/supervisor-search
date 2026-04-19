# Production Deployment

This document describes how to take `supervisor-search` to production on Cloudflare.

Use this together with:

- `docs/development.md` for local setup and import workflow details
- `docs/architecture.md` for the application structure
- `docs/roadmap.md` for the stronger-auth follow-up

## Overview

Production deployment has two separate parts:

1. Deploy the Cloudflare Worker.
2. Populate the production Vectorize index with supervisor records using the local import script.

The Worker is not useful until both are complete.

## 1. Prepare The Repo

Use the pinned toolchain and verify the project locally before touching production:

```bash
nvm use
npm install
npm run quality:gate
npm run ci:local:quiet
```

The repo keeps an exact npm pin in `package.json`, but hosted build providers may still execute a nearby npm 11 patch release during dependency installation. The repo's `devEngines` policy is intentionally relaxed to accept compatible npm 11 patch versions so Cloudflare-hosted installs do not fail before the Worker build starts.

## 2. Authenticate Wrangler

Log in with Wrangler:

```bash
npx wrangler login
```

Relevant docs:

- https://developers.cloudflare.com/workers/wrangler/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/

## 3. Confirm Worker Configuration

The production Worker configuration lives in `wrangler.jsonc`.

This repo currently expects:

- Worker name: `supervisor-search-worker`
- entrypoint: `src/worker.ts`
- Workers AI binding: `AI`
- Vectorize binding: `SUPERVISOR_SEARCH_INDEX`
- default embedding model var: `SUPERVISOR_SEARCH_EMBEDDING_MODEL`

Before deploying, confirm the index name in `wrangler.jsonc` matches the production Vectorize index you intend to use.

## 4. Create The Production Vectorize Index

Create the Vectorize index before import.

With the current default embedding model, the repo expects:

- dimension size: `768`
- metric: `cosine`

Example:

```bash
npx wrangler vectorize create supervisor-search --dimensions=768 --metric=cosine
```

Relevant docs:

- https://developers.cloudflare.com/vectorize/best-practices/create-indexes/

## 5. Configure Production Secrets

Set the shared Basic Auth secrets on the deployed Worker:

```bash
npx wrangler secret put SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME
npx wrangler secret put SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD
```

If you want non-default search throttling, also configure:

- `SUPERVISOR_SEARCH_RATE_LIMIT_MAX_REQUESTS`
- `SUPERVISOR_SEARCH_RATE_LIMIT_WINDOW_MS`

Do not store secrets in `wrangler.jsonc`.

Relevant docs:

- https://developers.cloudflare.com/workers/configuration/secrets/

## 6. Deploy The Worker

Deploy with the repo script:

```bash
npm run deploy
```

This publishes the Worker defined by `src/worker.ts`.

## 7. Import Production Data

The deployed Worker does not ingest confidential HTML directly.
Supervisor data must be imported locally with the operator script.

Set these environment variables in your shell:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `SUPERVISOR_SEARCH_INDEX_NAME`
- optional `SUPERVISOR_SEARCH_EMBEDDING_MODEL`

The import token must belong to the same Cloudflare account as `CLOUDFLARE_ACCOUNT_ID`.

Required Cloudflare API token permissions:

- For `--dry-run`:
  - `Workers AI - Read`
  - `Workers AI - Edit`
  - `Vectorize Read` or `Vectorize Write`
- For a real import:
  - `Workers AI - Read`
  - `Workers AI - Edit`
  - `Vectorize Write`

Run a dry run first:

```bash
npm run import:supervisors -- --input /absolute/path/to/snapshot.html --dry-run
```

If the counts and deletions look correct, run the real import:

```bash
npm run import:supervisors -- --input /absolute/path/to/snapshot.html
```

The importer includes guardrails for:

- suspiciously small parsed snapshots
- unusually large delete sets

Only override those checks after confirming the parser output.

## 8. Smoke Test Production

After deploy and import:

1. Open `/` and verify the Basic Auth challenge appears.
2. Sign in with the configured credentials.
3. Search a known topic and verify the returned supervisors look correct.
4. Check `/api/health`.
5. Confirm `styles.css` and `app.js` load successfully.

## 9. Operational Notes

- The current production auth model is shared Basic Auth. That is acceptable for a small internal audience, but broader rollout should move behind stronger upstream auth.
- The Worker now applies per-client search throttling, but the current limiter is Worker-local rather than durable or globally coordinated.
- The production import path requires Cloudflare credentials with Workers AI and Vectorize access.

## 10. Recommended Next Steps After First Deploy

- Introduce separate Wrangler environments for staging and production.
- Move broader access behind Cloudflare Access or another identity-aware proxy.
- Document the production index name and operational owner in your team notes.
- Run a fresh import whenever the authoritative supervisor snapshot changes.
