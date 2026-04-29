# Feature: Supervisor Search

## Blueprint

### Context

Supervisor Search helps MSc students discover relevant thesis supervisors without exposing the confidential source directory. The app should keep retrieval and ranking explainable, lightweight, and easy to tune as matching priorities change.

### Architecture

- **Entry points:** `GET /`, `GET /admin`, `GET /api/search?q=...`, `GET|PUT|DELETE /api/admin/search-weights`, `GET /api/health`, and the local `npm run import:supervisors -- --input <html-file>` command
- **Data models:** `SupervisorRecord` is the durable metadata shape stored alongside each vector. Required fields are `supervisorId`, `name`, `topicArea`, `activeThesisCount`, `searchText`, `sourceFingerprint`, and `importedAt`.
- **Identifier contract:** `SupervisorRecord.supervisorId` must be deterministic across repeated imports of the same supervisor record and short enough for the current Vectorize id limit.
- **Dependencies:** The deployed Worker depends on a Workers AI binding and a Vectorize binding. Runtime ranking overrides optionally depend on a dedicated KV binding for configuration only. The local import command depends on Cloudflare account credentials with Workers AI and Vectorize permissions.

### Anti-Patterns

- Do not store the confidential HTML snapshot in the repository or upload it through the public app surface.
- Do not treat committed sanitized fixtures as a substitute for the confidential operator snapshot. They exist for tests and dry-run verification only.
- Do not bury ranking logic inside route handlers. Matching weights and scoring must stay in dedicated supervisor-domain code.
- Do not add extra persistence layers such as D1, KV, or Durable Objects for v1 supervisor data. Runtime ranking configuration is the only accepted KV exception.

## Contract

### Definition of Done

- [ ] `GET /` renders a basic-auth-protected supervisor search page with realtime result updates.
- [ ] `GET /admin` renders a basic-auth-protected admin page that exposes the current live ranking weights and their storage source.
- [ ] `GET /` keeps the search surface minimal, with a search field and inline typing hint instead of long explanatory help text.
- [ ] `GET /` supports both light and dark color schemes without changing the minimal search-first layout.
- [ ] `GET /` keeps the search input and inline status visible with a sticky header treatment while result cards scroll below.
- [ ] `GET /` reflects the current search query in the browser URL so shared or refreshed pages restore the same query.
- [ ] `GET /api/search?q=...` returns ordered supervisor search results from either Vectorize or explicit local sample mode.
- [ ] `GET /api/search?q=...` returns no visible results unless each result has explicit lexical overlap with the supervisor topic area after alias expansion.
- [ ] `GET /api/search?q=...` expands common CS aliases such as `HCI`, `LLM`, `ML`, and `A11Y` so abbreviated queries still match the underlying topic terms.
- [ ] `GET /api/search?q=...` applies per-client throttling and returns `429` with retry guidance when a client exceeds the configured local rate limit.
- [ ] `GET|PUT|DELETE /api/admin/search-weights` returns, updates, and clears the live ranking weights without redeploying when the KV config binding is available.
- [ ] The import command performs full-snapshot parsing and Vectorize sync from a confidential local HTML file.
- [ ] Spec and ADR updates land in the same change set as the implementation.
- [ ] Automated tests cover parsing, auth, ranking, import diffing, browser search flows, and committed sanitized import fixtures.

### Regression Guardrails

- The deployed app must only search stored vectors and vector metadata, never the raw confidential HTML.
- Search ranking must remain tunable in code by editing exported weighting logic and sort order, not by changing the import contract.
- Runtime ranking overrides must remain a dedicated configuration concern. They must not move supervisor records or other search result data into KV.
- Sample data mode is a local fallback for development and tests only; it must not replace the live Vectorize path in configured environments.
- The import command must stop before mutating Vectorize when the parsed snapshot drops suspiciously below the current index size or when the delete set is abnormally large, unless the operator explicitly overrides that safety check.
- Imported `supervisorId` values must remain within the current Vectorize identifier length limit.
- HTML responses must ship with restrictive browser security headers, and client-side search code must load from a same-origin script asset so the CSP can keep `script-src 'self'`.
- Search throttling must stay enabled in configured environments, with per-client limits tunable through environment variables instead of hard-coded route edits.
- Live Vectorize search must retrieve a broad enough candidate pool before reranking to avoid obvious topical misses on common multi-word queries such as `web development`.
- Vector similarity may retrieve and rank candidates, but it must not make a supervisor visible without a clear topic-area token match.
- Search ranking must keep topical relevance ahead of thesis-load differences, while still using lower active thesis counts as a strong tie-breaker and scoring factor among relevant matches.
- Admin write operations must stay behind the existing authentication boundary, reject cross-origin browser mutations, and validate that the stored weight set stays within `[0,1]` and totals `1.0`.
- Any committed HTML import fixture must remain sanitized, anonymized, and free of authenticated page state or direct staff contact details.

### Verification

- **Automated tests:** Vitest covers parser heuristics, ranking, auth, worker responses, and import planning. Playwright covers the auth gate and live search UI behavior against the local sample-data mode.
- **Coverage target:** The supervisor-domain and Worker entry code must remain within the repo coverage gate enforced by `npm run test:coverage`.

### Scenarios

**Scenario: Student searches by research topic**

- Given: the Worker has valid basic-auth credentials and Vectorize-backed supervisor metadata
- When: the student searches for a topic such as `distributed systems`
- Then: `/api/search` returns matching supervisors ordered by weighted relevance, with lower active thesis counts helping break ties among otherwise similar matches, and the UI updates without a full reload

**Scenario: Student searches without a clear topic match**

- Given: Vectorize retrieves candidates whose embeddings look similar but whose topic areas do not share lexical topic terms with the query
- When: the student searches for that query
- Then: `/api/search` returns an empty result list instead of showing those vector-only candidates

**Scenario: Student refreshes or shares a search URL**

- Given: the search page is open with a query such as `distributed systems`
- When: the browser refreshes the page or another user opens the shared `?q=` URL
- Then: the search input is prefilled from the query parameter and the same search runs automatically

**Scenario: Operator updates ranking weights without redeploying**

- Given: the Worker has valid basic-auth credentials and a configured runtime ranking KV binding
- When: an operator opens `/admin` and updates the stored weight mix
- Then: subsequent `/api/search` responses return and use the new live weight set without requiring a redeploy

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
