# Development

This document collects development-facing setup and workflow notes for the template.

## Agent Context

The template vendors the ASDLC knowledge base in `.asdlc/`.

- Start with `.asdlc/SKILL.md` for ASDLC concepts, patterns, and practices.
- Use `AGENTS.md` as the Codex-native context anchor for this repo.

## Local Setup

This template is set up for the local Agent CI runner from `agent-ci.dev`.

### Prerequisites

- Local development in this template targets macOS. The documented commands assume a macOS shell environment and are not maintained as a cross-platform baseline.
- Run `nvm use` before `npm install` or any other development command so your shell uses the Node.js version mirrored in `.nvmrc`, which keeps the bundled npm version close to the repo pin as well.
- Install dependencies with `npm install`.
- `npm install` also configures the repo-managed Git hook path and enables the `pre-push` hook that runs `npm run quality:gate:fast`.
- The exact Node.js version is pinned in `package.json`, mirrored in `.nvmrc` for `nvm` users, and read directly by CI through `actions/setup-node`.
- The repo pins npm exactly in `package.json` as the source-of-truth version. Using `nvm use` is the expected local path for staying close to that npm baseline, and CI upgrades npm to the exact pinned version after `actions/setup-node` and invokes that pinned CLI directly for install and verification steps. `devEngines` intentionally accepts a compatible npm 11 patch release so hosted build providers such as Cloudflare can still install dependencies when their bundled npm lags slightly behind the repo pin.
- Copy `.dev.vars.example` to `.dev.vars` and replace placeholder values when a project needs local secrets.
- Copy `.env.agent-ci.example` to `.env.agent-ci` when you need machine-local Agent CI overrides. Agent CI loads that file automatically.
- If your clone has no `origin` remote, set `GITHUB_REPO=owner/repo` in `.env.agent-ci` to stop Agent CI from warning while inferring the repository name.
- If your Docker CLI uses a non-default socket or context, set `DOCKER_HOST=...` in `.env.agent-ci` so Agent CI reaches the same engine as `docker info`.
- Start a Docker runtime before running Agent CI.
- Install the GitHub Actions runner image once with `docker pull ghcr.io/actions/actions-runner:latest`.

The repo pins CLI tooling in `devDependencies`, including Wrangler for Cloudflare-based experiments. Prefer invoking those tools through `npx` or repo scripts so the project version is used instead of a global install.

## Local Runtime

- Start the local Worker with `npm run dev`.
- Open `http://127.0.0.1:8787` in your browser.
- Rebuild the generated stylesheet manually with `npm run build:css` when needed.

The Worker now serves the supervisor-search app from `src/worker.ts`. `npm run dev` starts it on `http://127.0.0.1:8787`, and Playwright uses `npm run e2e:server` on `http://127.0.0.1:8788` with test-only credentials and sample supervisor data so browser tests stay deterministic and local. API modules live under `src/api/`, supervisor-domain logic lives under `src/supervisors/`, view modules live under `src/views/`, and tests are colocated under `src/`.

## Commands

### Local CI and Verification

If local CI fails with `No such image: ghcr.io/actions/actions-runner:latest`, pull that image manually and re-run the workflow.

If local CI warns with `No such remote 'origin'`, add `GITHUB_REPO=owner/repo` to `.env.agent-ci` and rerun the workflow.

- Run the local workflow with `npm run ci:local`.
- Run the quiet local workflow with `npm run ci:local:quiet`.
- Run all relevant workflows with `npm run ci:local:all`.
- Run the fast local gate with `npm run quality:gate:fast`.
- Run the baseline quality gate with `npm run quality:gate`.
- Run the shipped runtime dependency audit with `npm run security:audit`.
- Install the Playwright browser with `npm run playwright:install`.
- Run end-to-end tests with `npm run e2e`.
- Run unit and integration tests with `npm test`.
- Run the unit coverage gate with `npm run test:coverage`.
- Run TypeScript checks with `npm run typecheck`.
- Run Lighthouse with `LIGHTHOUSE_URL=http://127.0.0.1:8787 LIGHTHOUSE_SERVER_COMMAND="npm run dev" npm run lighthouse`.
- Format the repo with `npm run format`.
- Check formatting with `npm run format:check`.
- If a run pauses on failure, fix the issue and resume with `npm run ci:local:retry -- --name <runner-name>`.

The GitHub Actions CI workflow splits fast checks from browser checks into separate jobs, reads the pinned Node version from `package.json`, upgrades npm to the repo-pinned version from `package.json`, runs repository-shape validation as part of the fast job, runs the browser job in the version-pinned Playwright container image `mcr.microsoft.com/playwright:v1.59.1-noble`, and cancels superseded runs on the same ref. That keeps the browser job from reinstalling Chromium on every run while still matching the repo's pinned Playwright version.

The starter UI now follows the same Tailwind v4 baseline shape as `thesis-journey-tracker`: Tailwind input lives in `src/tailwind-input.css`, generated CSS is written to `.generated/styles.css`, and Wrangler runs `npm run build:css` automatically before local development.

The Lighthouse setup is also generic, but the Worker stub gives it a concrete local target. Use `LIGHTHOUSE_URL=http://127.0.0.1:8787 LIGHTHOUSE_SERVER_COMMAND="npm run dev" npm run lighthouse`. Reports are written to `reports/lighthouse/`.

The Vitest setup is generic as well. `vitest.config.ts` targets colocated `src/**/*.test.ts` files while excluding `src/**/*.e2e.ts`. The default `npm test` command uses `--passWithNoTests` so the template remains usable before a project adds its first test file.

The coverage gate is stricter than the basic test run. `npm run test:coverage` measures runtime `src/**` code with the V8 provider, writes reports to `reports/coverage/`, and enforces high thresholds once a project actually has `src/` code. Colocated unit tests, end-to-end tests, and test-support files do not count as source files for the gate's skip-or-fail logic.

The TypeScript setup is generic too. `tsconfig.json` covers repo-level `.ts` files and `src/**/*.ts`, and `npm run typecheck` runs `tsc --noEmit`.

### Supervisor Search

The deployed app expects a Vectorize index binding, a Workers AI binding, and basic-auth credentials.

- In `wrangler.jsonc`, the Worker binds:
  - `AI` for embeddings through Workers AI, with `remote: true` for local `wrangler dev`
  - `SUPERVISOR_SEARCH_INDEX` for the Vectorize index, with `remote: true` for local `wrangler dev`
  - `SUPERVISOR_SEARCH_EMBEDDING_MODEL` as a configurable default model id
- In `.dev.vars`, set:
  - `SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME`
  - `SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD`
- Optional local-only switch:
  - `SUPERVISOR_SEARCH_USE_SAMPLE_DATA=true` uses built-in sample supervisors instead of live Vectorize search
- Optional runtime throttling controls:
  - `SUPERVISOR_SEARCH_RATE_LIMIT_MAX_REQUESTS` sets the maximum `/api/search` requests allowed per client within the active window
  - `SUPERVISOR_SEARCH_RATE_LIMIT_WINDOW_MS` sets the throttling window duration in milliseconds

During local development, the Worker code still runs on your machine, but Workers AI and Vectorize must connect to Cloudflare remotely. If `remote: true` is missing from either binding, local search requests fail with errors such as `Binding AI needs to be run remotely`.

Do not start the app with `wrangler dev --local` when you want live search. Cloudflare's local-development docs note that `--local` disables remote bindings, which breaks both the Workers AI and Vectorize paths. Use the normal `npm run dev` script for live Cloudflare-backed search, or enable `SUPERVISOR_SEARCH_USE_SAMPLE_DATA=true` if you want a fully local sample-data session instead.

Local remote-binding development also depends on Cloudflare preview infrastructure. `wrangler.jsonc` enables `preview_urls: true`, but your Cloudflare account still needs a configured `workers.dev` subdomain and Preview URLs enabled for this Worker. If `npm run dev` fails on `/workers/subdomain/edge-preview`, enable those settings in Workers & Pages, run `npm run deploy` once, and then retry local development.

For a live Vectorize-backed environment, create an index that matches the embedding model dimensions. With the default `@cf/google/embeddinggemma-300m` model, the expected shape is 768 dimensions with cosine similarity. One example command is:

```bash
npx wrangler vectorize create supervisor-search --dimensions=768 --metric=cosine
```

### Import Workflow

The confidential HTML source must stay outside the repository. The local import command reads a snapshot from disk, parses supervisors, generates embeddings through Workers AI, and performs a full-snapshot Vectorize sync.

For parser work and dry-run import testing, the repo also ships a sanitized fixture at `src/supervisors/fixtures/sanitized-supervisor-snapshot.html`. That fixture is safe to commit because it is anonymized and stripped of authenticated page state, but it must not be mistaken for the real operator snapshot.

Required environment variables for the import command:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `SUPERVISOR_SEARCH_INDEX_NAME`
- Optional: `SUPERVISOR_SEARCH_EMBEDDING_MODEL`

The import token must be scoped to the same Cloudflare account as `CLOUDFLARE_ACCOUNT_ID`.

Required Cloudflare API token permissions:

- For `--dry-run`:
  - `Workers AI - Read`
  - `Workers AI - Edit`
  - `Vectorize Read` or `Vectorize Write`
- For a real import run:
  - `Workers AI - Read`
  - `Workers AI - Edit`
  - `Vectorize Write`

Why:

- The script calls the Workers AI REST API to create embeddings even during `--dry-run`.
- The script calls Vectorize list/info endpoints during `--dry-run`.
- A real import additionally calls Vectorize upsert and delete endpoints, which require `Vectorize Write`.

Run the import with:

```bash
npm run import:supervisors -- --input /absolute/path/to/confidential-supervisors.html
```

The importer applies safety checks before mutating Vectorize:

- It rejects parsed snapshots that drop too far below the current index size unless you explicitly lower `--minimum-supervisor-count`.
- It rejects unusually large delete sets unless you explicitly raise `--max-delete-ratio` or pass `--allow-large-delete`.

Use `--dry-run` to validate parsing and sync counts without mutating Vectorize:

```bash
npm run import:supervisors -- --input /absolute/path/to/confidential-supervisors.html --dry-run
```

If Cloudflare returns an unexpected error, rerun with `--debug` to print the resolved import configuration, request path, HTTP status, and response-body summary for the failing API call:

```bash
npm run import:supervisors -- --input /absolute/path/to/confidential-supervisors.html --dry-run --debug
```

You can also smoke-test the importer against the sanitized fixture after setting the same Cloudflare import variables:

```bash
npm run import:supervisors -- --input ./src/supervisors/fixtures/sanitized-supervisor-snapshot.html --dry-run
```

The API token used for imports needs Workers AI write access and Vectorize read/write access.

## Security Baseline

The template keeps secret handling lightweight and explicit:

- Keep local secrets in untracked files such as `.dev.vars`.
- Commit example files such as `.dev.vars.example` with placeholder values only.
- Treat `npm run security:audit` as part of the baseline gate for shipped runtime dependencies.

## Quality Gate

Use this expectation for routine changes:

- `npm run quality:gate` must pass before a change is considered ready.
- Use `npm run quality:gate:fast` for quicker local iteration when browser coverage is not the immediate focus.
- `npm run ci:local:quiet` should also pass before proposing or landing the change.
- The repo-managed `pre-push` hook runs `npm run quality:gate:fast` automatically after `npm install`, so pushes stop locally when the fast gate is already red.

The quality gate currently runs the fast gate first, then the Playwright browser gate. The local and remote CI workflow runs separate fast and browser jobs, with repository-shape validation included in the fast job. Local Agent CI runs should go through the repo-pinned `agent-ci` binary directly, and local browser installation should also go through the pinned `npm run playwright:install` script.
