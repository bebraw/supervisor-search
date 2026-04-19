# ADR-015: Run The Fast Gate On Pre-Push

**Status:** Accepted

**Date:** 2026-04-19

## Context

The repo already documents `npm run quality:gate` and `npm run ci:local:quiet` as part of done work, but that expectation still relies on contributors remembering to run them manually.

That gap is large enough to let obvious regressions escape the local machine. In this case, a stale assertion in `src/views/home.test.ts` broke the fast gate remotely even though the failure was cheap and deterministic locally.

We wanted a safeguard that catches those failures before a push, without adding a heavy Git-hook dependency or forcing the full browser gate on every commit.

## Decision

We will manage Git hooks inside the repo with a committed `.githooks/` directory and configure that path from `npm install` through `scripts/setup-git-hooks.mjs`.

The repo-managed `pre-push` hook will run:

- `npm run quality:gate:fast`

This keeps the push-time check aligned with the repo's existing fast gate contract while leaving the full gate and local Agent CI workflow as the definition of done for ready changes.

## Trigger

This decision was triggered by a CI failure caused by a stale local test expectation that the existing fast gate would have caught immediately if it had been run before pushing.

## Consequences

**Positive:**

- Cheap local failures block the push before remote CI starts.
- Hook setup stays lightweight and repo-local without adding Husky or similar tooling.
- New clones pick up the hook automatically through the normal `npm install` path.

**Negative:**

- Pushes now pay the fast-gate cost even for small changes.
- Contributors can still bypass hooks deliberately, so this improves the default path rather than making failure impossible.

**Neutral:**

- The full quality gate and local Agent CI remain required before considering a change ready.
- Browser tests are still kept out of the push hook to avoid making routine pushes unnecessarily heavy.

## Alternatives Considered

### Keep the workflow fully manual

This was rejected because the current failure already showed that documentation alone is not a strong enough guardrail for cheap deterministic checks.

### Run the full quality gate on pre-push

This was rejected because Playwright coverage is still materially heavier than formatting, type checking, audit, and unit coverage. The repo already split the fast and browser paths so quick failures can return sooner, and the push hook should preserve that intent.

### Run the fast gate on pre-commit instead

This was rejected because it would interrupt normal checkpoint commits too aggressively. Push time is the better boundary for protecting remote CI while keeping local iteration lighter.
