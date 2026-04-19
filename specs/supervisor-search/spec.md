# Feature: Supervisor Search

## Blueprint

### Context

Supervisor Search helps MSc students discover relevant thesis supervisors without exposing the confidential source directory. The app should keep retrieval and ranking explainable, lightweight, and easy to tune as matching priorities change.

### Architecture

- **Entry points:** `GET /`, `GET /api/search?q=...`, `GET /api/health`, and the local `npm run import:supervisors -- --input <html-file>` command
- **Data models:** `SupervisorRecord` is the durable metadata shape stored alongside each vector. Required fields are `supervisorId`, `name`, `topicArea`, `activeThesisCount`, `searchText`, `sourceFingerprint`, and `importedAt`.
- **Dependencies:** The deployed Worker depends on a Workers AI binding and a Vectorize binding. The local import command depends on Cloudflare account credentials with Workers AI and Vectorize permissions.

### Anti-Patterns

- Do not store the confidential HTML snapshot in the repository or upload it through the public app surface.
- Do not treat committed sanitized fixtures as a substitute for the confidential operator snapshot. They exist for tests and dry-run verification only.
- Do not bury ranking logic inside route handlers. Matching weights and scoring must stay in dedicated supervisor-domain code.
- Do not add extra persistence layers such as D1, KV, or Durable Objects for v1 supervisor data.

## Contract

### Definition of Done

- [ ] `GET /` renders a basic-auth-protected supervisor search page with realtime result updates.
- [ ] `GET /api/search?q=...` returns ordered supervisor search results from either Vectorize or explicit local sample mode.
- [ ] The import command performs full-snapshot parsing and Vectorize sync from a confidential local HTML file.
- [ ] Spec and ADR updates land in the same change set as the implementation.
- [ ] Automated tests cover parsing, auth, ranking, import diffing, browser search flows, and committed sanitized import fixtures.

### Regression Guardrails

- The deployed app must only search stored vectors and vector metadata, never the raw confidential HTML.
- Search ranking must remain tunable in code by editing exported weighting logic, not by changing the import contract.
- Sample data mode is a local fallback for development and tests only; it must not replace the live Vectorize path in configured environments.
- Any committed HTML import fixture must remain sanitized, anonymized, and free of authenticated page state or direct staff contact details.

### Verification

- **Automated tests:** Vitest covers parser heuristics, ranking, auth, worker responses, and import planning. Playwright covers the auth gate and live search UI behavior against the local sample-data mode.
- **Coverage target:** The supervisor-domain and Worker entry code must remain within the repo coverage gate enforced by `npm run test:coverage`.

### Scenarios

**Scenario: Student searches by research topic**

- Given: the Worker has valid basic-auth credentials and Vectorize-backed supervisor metadata
- When: the student searches for a topic such as `distributed systems`
- Then: `/api/search` returns the best matching supervisors ordered by the hybrid score, and the UI updates without a full reload

**Scenario: Supervisor import refreshes the full snapshot**

- Given: an operator has a fresh confidential HTML snapshot and valid Cloudflare credentials
- When: they run `npm run import:supervisors -- --input /path/to/snapshot.html`
- Then: the command parses supervisors, upserts the current snapshot into Vectorize, and removes ids no longer present

**Scenario: Unauthorized requests are blocked**

- Given: a request without valid basic-auth credentials
- When: it targets `/` or `/api/search`
- Then: the Worker responds with `401` and a `WWW-Authenticate` challenge
