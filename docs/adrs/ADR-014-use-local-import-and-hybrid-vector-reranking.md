# ADR-014: Use Local Import and Hybrid Vector Reranking

**Status:** Accepted

## Context

The supervisor search project needs to ingest confidential supervisor information from an HTML page that cannot be committed to the repository or exposed through a public upload flow. The deployed app also needs ranking logic that can evolve quickly as topic fit and supervisor availability change in importance.

We needed to decide:

1. whether ingestion should happen locally or through the deployed Worker
2. whether v1 should introduce another persistence layer beyond Vectorize metadata
3. whether ranking should be vector-only or reranked in application code

## Decision

We will:

- keep ingestion as a local operator command that reads a confidential HTML snapshot from disk
- use Workers AI to create embeddings and Vectorize metadata as the only v1 storage for supervisor search records
- use Vectorize for candidate retrieval and rerank those candidates in Worker code with explicit weighted signals for vector similarity, topic overlap, and supervisor availability
- require explicit lexical overlap with the supervisor topic area before any candidate is returned to the user; vector similarity can influence ranking among topic matches, but cannot make a vector-only candidate visible

## Consequences

### Positive

- The confidential source HTML stays outside the deployed application surface.
- Ranking weights remain easy to inspect and change in code without changing the import format.
- The v1 architecture stays small: one Worker, one Vectorize index, and one Workers AI binding.
- Stored vector metadata is enough to render search results without introducing D1, KV, or Durable Objects.
- Search results remain conservative and explainable because every visible result has a direct topic-area text match after alias expansion.

### Negative

- Local operators need Cloudflare credentials with both Workers AI and Vectorize access to run imports.
- The parser must tolerate the confidential HTML structure without help from a dedicated HTML parsing dependency.
- Full-snapshot refreshes may rewrite many vectors even for small source changes.
- Pure semantic matches and paraphrases without shared topic vocabulary are intentionally hidden until the topic data or alias map makes that match explicit.

## Alternatives Considered

### Worker-hosted admin ingestion

Rejected because it would expand the deployed attack surface around confidential source data and complicate auth for an operation that only needs to be run by a small internal audience.

### Add D1 or KV for metadata storage

Rejected because Vectorize metadata already covers the v1 result-card needs and an extra data store would increase moving parts without adding necessary behavior.

### Vector-only ranking

Rejected because availability and explicit topic tuning are part of the product requirement. A pure vector score would make those trade-offs harder to audit and adjust.

### Vector-visible semantic fallback

Rejected because the search surface must not show supervisors unless the query has a clear topic match. Semantic retrieval is still useful for candidate recall, but final visibility needs a deterministic topic-area gate that students and operators can inspect.
