# Feature: Supervisor Search

## Blueprint

### Context

Supervisor Search helps MSc students discover relevant thesis supervisors without exposing the confidential source directory. The app should keep retrieval and ranking explainable, lightweight, and easy to tune as matching priorities change.

### Architecture

- **Entry points:** `GET /`, `GET /api/search?q=...`, `GET /api/health`, and the local `npm run import:supervisors -- --input <html-file>` command
- **Data models:** `SupervisorRecord` is the durable metadata shape stored alongside each vector. Required fields are `supervisorId`, `name`, `topicArea`, `activeThesisCount`, `searchText`, `sourceFingerprint`, and `importedAt`.
- **Identifier contract:** `SupervisorRecord.supervisorId` must be deterministic across repeated imports of the same supervisor record and short enough for the current Vectorize id limit.
- **Dependencies:** The deployed Worker depends on a Workers AI binding and a Vectorize binding. The local import command depends on Cloudflare account credentials with Workers AI and Vectorize permissions.

### Anti-Patterns

- Do not store the confidential HTML snapshot in the repository or upload it through the public app surface.
- Do not treat committed sanitized fixtures as a substitute for the confidential operator snapshot. They exist for tests and dry-run verification only.
- Do not bury ranking logic inside route handlers. Matching weights and scoring must stay in dedicated supervisor-domain code.
- Do not add extra persistence layers such as D1, KV, or Durable Objects for v1 supervisor data.

## Contract

### Definition of Done

- [ ] `GET /` renders a basic-auth-protected supervisor search page with realtime result updates.
- [ ] `GET /` keeps the search surface minimal, with a search field and inline typing hint instead of long explanatory help text.
- [ ] `GET /` supports both light and dark color schemes without changing the minimal search-first layout.
- [ ] `GET /api/search?q=...` returns ordered supervisor search results from either Vectorize or explicit local sample mode.
- [ ] `GET /api/search?q=...` expands common CS aliases such as `HCI`, `LLM`, `ML`, and `A11Y` so abbreviated queries still match the underlying topic terms.
- [ ] `GET /api/search?q=...` applies per-client throttling and returns `429` with retry guidance when a client exceeds the configured local rate limit.
- [ ] The import command performs full-snapshot parsing and Vectorize sync from a confidential local HTML file.
- [ ] Spec and ADR updates land in the same change set as the implementation.
- [ ] Automated tests cover parsing, auth, ranking, import diffing, browser search flows, and committed sanitized import fixtures.

### Regression Guardrails

- The deployed app must only search stored vectors and vector metadata, never the raw confidential HTML.
- Search ranking must remain tunable in code by editing exported weighting logic, not by changing the import contract.
- Sample data mode is a local fallback for development and tests only; it must not replace the live Vectorize path in configured environments.
- The import command must stop before mutating Vectorize when the parsed snapshot drops suspiciously below the current index size or when the delete set is abnormally large, unless the operator explicitly overrides that safety check.
- Imported `supervisorId` values must remain within the current Vectorize identifier length limit.
- HTML responses must ship with restrictive browser security headers, and client-side search code must load from a same-origin script asset so the CSP can keep `script-src 'self'`.
- Search throttling must stay enabled in configured environments, with per-client limits tunable through environment variables instead of hard-coded route edits.
- Any committed HTML import fixture must remain sanitized, anonymized, and free of authenticated page state or direct staff contact details.

### Verification

- **Automated tests:** Vitest covers parser heuristics, ranking, auth, worker responses, and import planning. Playwright covers the auth gate and live search UI behavior against the local sample-data mode.
- **Coverage target:** The supervisor-domain and Worker entry code must remain within the repo coverage gate enforced by `npm run test:coverage`.

### Scenarios

**Scenario: Student searches by research topic**

- Given: the Worker has valid basic-auth credentials and Vectorize-backed supervisor metadata
- When: the student searches for a topic such as `distributed systems`
- Then: `/api/search` returns the best matching supervisors ordered by the hybrid score, and the UI updates without a full reload

**Scenario: Search throttling protects the API**

- Given: a client has already consumed the configured number of `/api/search` requests within the active throttle window
- When: that same client issues another search request before the window resets
- Then: the Worker responds with `429` and retry guidance instead of executing another search

**Scenario: Student searches with a common CS abbreviation**

- Given: the Worker has valid supervisor metadata for topics such as human-computer interaction or large language models
- When: the student searches using an abbreviation such as `HCI` or `LLM`
- Then: `/api/search` expands that abbreviation during retrieval and reranking so the matching supervisors still rank correctly

**Scenario: Supervisor import refreshes the full snapshot**

- Given: an operator has a fresh confidential HTML snapshot and valid Cloudflare credentials
- When: they run `npm run import:supervisors -- --input /path/to/snapshot.html`
- Then: the command parses supervisors, upserts the current snapshot into Vectorize, and removes ids no longer present

**Scenario: Unauthorized requests are blocked**

- Given: a request without valid basic-auth credentials
- When: it targets `/` or `/api/search`
- Then: the Worker responds with `401` and a `WWW-Authenticate` challenge
