# ADR-017: Use KV For Runtime Ranking Configuration

**Status:** Accepted

**Date:** 2026-04-20

## Context

Supervisor search ranking currently uses explicit weights for vector similarity, topic overlap, and supervisor availability. Those weights are easy to inspect in code, but any adjustment still requires a code change and redeploy.

The product need for ranking changes is narrower than a full search-architecture migration. Operators need a small authenticated surface that can tune the live ranking mix while the Worker is running, without changing the supervisor import flow or introducing mutable supervisor metadata storage.

We needed to decide whether runtime ranking configuration should remain code-only or gain a lightweight mutable store.

## Decision

We will:

- keep code-defined defaults for supervisor ranking weights
- add a dedicated Cloudflare KV binding for runtime ranking overrides only
- serve an authenticated `/admin` surface and `/api/admin/search-weights` API for reading, updating, and resetting the live weight set
- read the current weight override during search requests and fall back to code defaults when the KV binding is absent or the stored payload is invalid
- keep supervisor records in Vectorize metadata only; KV is not a second data store for supervisor content

The stored weight payload must stay small, explicit, and validated before it is persisted or applied.

## Consequences

### Positive

- Operators can tune live ranking behavior without redeploying the Worker.
- Default ranking behavior still remains obvious in code and usable without KV.
- The added persistence surface is limited to a single configuration object instead of supervisor result data.

### Negative

- The Worker now has an optional second runtime dependency when live tuning is enabled.
- Admin mutations add a small write surface that must stay authenticated, same-origin, and narrowly validated.
- Search requests now depend on one extra configuration read before reranking.

## Alternatives Considered

### Keep Ranking Weights Code-Only

Rejected because it forces redeploys for operational tuning even though the data being changed is a tiny runtime configuration object.

### Store Runtime Weights In Memory Only

Rejected because Worker instances are not a reliable shared mutable store and would not produce durable behavior across instances or restarts.

### Store Runtime Weights Alongside Supervisor Metadata

Rejected because it would blur the boundary between supervisor data and operational configuration, making both the architecture and the import flow harder to reason about.
