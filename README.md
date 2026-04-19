# supervisor-search

`supervisor-search` is a Cloudflare Worker application for helping MSc students find a suitable thesis supervisor. A confidential HTML snapshot is parsed locally, embedded, and synced into Vectorize. The deployed app stays lightweight: it serves a basic-auth-protected search UI and a realtime search API that reranks Vectorize candidates in Worker code.

The repository also includes a sanitized fixture at `src/supervisors/fixtures/sanitized-supervisor-snapshot.html` for parser and dry-run import testing. That fixture is anonymized and intentionally stripped down; it is not the confidential source snapshot used for production imports.

The repo vendors ASDLC reference material in `.asdlc/` as local guidance instead of recreating it per project. Repo-specific truth lives in `ARCHITECTURE.md`, `specs/`, and `docs/adrs/`: generated code still needs to match those documents, and passing CI alone is not enough.

Local development in this repo targets macOS. Other platforms may need script and tooling adjustments before the baseline workflow works as documented.

## Documentation

- Development setup and local CI: `docs/development.md`
- Architecture decisions: `docs/adrs/README.md`
- Feature and architecture specs: `specs/README.md`
- Agent behavior and project rules: `AGENTS.md`

## Runtime

- Run `nvm use` before `npm install` or any other development command so your shell picks up the repo-pinned Node.js version from `.nvmrc` and stays close to the expected npm baseline.
- Install dependencies with `npm install`.
- The exact project Node.js version is pinned in `package.json` and mirrored in `.nvmrc` for `nvm` users, and CI reads the `package.json` value directly.
- npm is also pinned exactly in `package.json`; local development is expected to use `nvm use`, and CI upgrades npm to the exact repo pin when the bundled npm version differs.
- Copy `.dev.vars.example` to `.dev.vars` before running the Worker locally.
- Use repo-pinned CLI tools through `npx`, including `npx wrangler` for Cloudflare-based experiments.
- Start the Worker with `npm run dev`, then open `http://127.0.0.1:8787`.
- Rebuild the generated Tailwind stylesheet manually with `npm run build:css` when needed.
- Import a confidential supervisor snapshot with `npm run import:supervisors -- --input /absolute/path/to/snapshot.html`.
- Dry-run the importer against the sanitized fixture with `npm run import:supervisors -- --input ./src/supervisors/fixtures/sanitized-supervisor-snapshot.html --dry-run` after configuring the normal Cloudflare import credentials.

## Verification

- Run the fast local gate with `npm run quality:gate:fast` during normal iteration.
- Run the baseline repo gate with `npm run quality:gate`.
- Run the containerized local workflow with `npm run ci:local:quiet`.
- If local Agent CI warns about `No such remote 'origin'`, set `GITHUB_REPO=owner/repo` in `.env.agent-ci`.
- Retry a paused local CI run with `npm run ci:local:retry -- --name <runner-name>`.
- Install the pinned Playwright browser with `npm run playwright:install`.
- Run unit tests from colocated `src/**/*.test.ts` files with `npm test`.
- Run browser tests from colocated `src/**/*.e2e.ts` files with `npm run e2e`.

## App Surface

- `GET /` serves the basic-auth-protected supervisor search page.
- `GET /styles.css` serves the generated Tailwind stylesheet.
- `GET /api/search?q=...` serves realtime supervisor search results as JSON.
- `GET /api/health` serves a JSON health response for smoke tests and tooling.

## Source Layout

- `src/worker.ts` is the Worker entry point and top-level router.
- `src/api/` holds API response modules such as the search and health endpoints.
- `src/supervisors/` holds parsing, ranking, auth, and import logic for the supervisor domain.
- `src/views/` holds HTML rendering modules for the search UI.
- Tests live next to the code they exercise under `src/`.
