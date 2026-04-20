import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SUPERVISOR_SEARCH_WEIGHTS } from "./config.ts";
import { createSearchText, parseSupervisorsHtml, tokenizeSearchText } from "./parser.ts";
import { buildSupervisorRecord } from "./parser.ts";
import { createEmbedding, searchSampleSupervisors, searchSupervisors } from "./service.ts";

describe("searchSupervisors", () => {
  it("uses Vectorize candidates when live bindings are configured", async () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const distributed = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems and dependable cloud infrastructure",
      activeThesisCount: 2,
      rawSource: "distributed",
      importedAt,
    });

    const response = await searchSupervisors("distributed systems", {
      AI: {
        async run(model, input) {
          expect(model).toBe("@cf/google/embeddinggemma-300m");
          expect(input.text).toBe("distributed systems");
          return { data: [[0.25, 0.75]] };
        },
      },
      SUPERVISOR_SEARCH_INDEX: {
        async query(vector, options) {
          expect(Array.from(vector)).toEqual([0.25, 0.75]);
          expect(options).toMatchObject({
            topK: 50,
            returnMetadata: "all",
          });

          return {
            matches: [
              { id: distributed.supervisorId, score: 0.82, metadata: distributed },
              { id: "bad", score: 0.99, metadata: { nope: true } },
            ],
          };
        },
      },
    });

    expect(response).toMatchObject({
      ok: true,
      source: "vectorize",
    });
    expect(response.results[0]?.name).toBe("Tuomas Koski");
  });

  it("expands common CS aliases before creating live embeddings", async () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const hci = buildSupervisorRecord({
      name: "Leena Heikkila",
      topicArea: "Human-computer interaction and accessibility research",
      activeThesisCount: 2,
      rawSource: "hci",
      importedAt,
    });

    const response = await searchSupervisors("hci", {
      AI: {
        async run(_model, input) {
          expect(input.text).toBe("hci human computer interaction");
          return { data: [[0.1, 0.9]] };
        },
      },
      SUPERVISOR_SEARCH_INDEX: {
        async query() {
          return {
            matches: [{ id: hci.supervisorId, score: 0.8, metadata: hci }],
          };
        },
      },
    });

    expect(response.results[0]?.name).toBe("Leena Heikkila");
  });

  it("requests a wider candidate pool so web development matches survive retrieval", async () => {
    const html = readFileSync("./src/supervisors/fixtures/sanitized-supervisor-snapshot.html", "utf8");
    const supervisors = parseSupervisorsHtml(html, "2026-04-19T12:00:00.000Z");
    const query = "web development";
    const queryTokens = new Set(tokenizeSearchText(query));

    const response = await searchSupervisors(query, {
      AI: {
        async run() {
          return { data: [[0.4, 0.6]] };
        },
      },
      SUPERVISOR_SEARCH_INDEX: {
        async query(_vector, options) {
          expect(options).toMatchObject({
            topK: 50,
            returnMetadata: "all",
          });

          return {
            matches: supervisors.map((supervisor) => ({
              id: supervisor.supervisorId,
              score: calculateMockSimilarity(queryTokens, supervisor),
              metadata: supervisor,
            })),
          };
        },
      },
    });

    expect(response.results.slice(0, 3).every((result) => result.topicArea.toLowerCase().includes("web development"))).toBe(true);
    expect(response.results[0]?.activeThesisCount).toBe(3);
  });

  it("throws when live bindings are missing", async () => {
    await expect(searchSupervisors("distributed systems", {})).rejects.toThrow("Supervisor search bindings are not configured.");
  });

  it("uses stored runtime weights when a KV override is configured", async () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const distributed = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems and dependable cloud infrastructure",
      activeThesisCount: 2,
      rawSource: "distributed",
      importedAt,
    });

    const response = await searchSupervisors("distributed systems", {
      AI: {
        async run() {
          return { data: [[0.25, 0.75]] };
        },
      },
      SUPERVISOR_SEARCH_INDEX: {
        async query() {
          return {
            matches: [{ id: distributed.supervisorId, score: 0.82, metadata: distributed }],
          };
        },
      },
      SUPERVISOR_SEARCH_CONFIG: {
        async get() {
          return JSON.stringify({
            version: 1,
            updatedAt: "2026-04-20T09:00:00.000Z",
            weights: {
              vectorSimilarity: 0.3,
              topicOverlap: 0.3,
              availability: 0.4,
            },
          });
        },
        async put() {
          throw new Error("not used");
        },
        async delete() {
          throw new Error("not used");
        },
      },
    });

    expect(response.weights).toEqual({
      vectorSimilarity: 0.3,
      topicOverlap: 0.3,
      availability: 0.4,
    });
  });
});

describe("createEmbedding", () => {
  it("supports the direct Workers AI embedding shape", async () => {
    const embedding = await createEmbedding(
      {
        async run() {
          return { data: [[0.1, 0.2, 0.3]] };
        },
      },
      "@cf/google/embeddinggemma-300m",
      "distributed systems",
    );

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("supports the REST-style embedding envelope", async () => {
    const embedding = await createEmbedding(
      {
        async run() {
          return { result: { data: [[0.4, 0.5]] } } as unknown as { data: number[][] };
        },
      },
      "@cf/google/embeddinggemma-300m",
      "cybersecurity",
    );

    expect(embedding).toEqual([0.4, 0.5]);
  });

  it("throws when the model returns no embedding", async () => {
    await expect(
      createEmbedding(
        {
          async run() {
            return { data: [] };
          },
        },
        "@cf/google/embeddinggemma-300m",
        "empty",
      ),
    ).rejects.toThrow("Embedding model returned an empty vector.");
  });
});

describe("searchSampleSupervisors", () => {
  it("returns a stable sample-mode response", () => {
    const response = searchSampleSupervisors("");

    expect(response).toMatchObject({
      ok: true,
      source: "sample",
      results: expect.any(Array),
    });
  });

  it("matches common CS aliases against expanded topic terms", () => {
    const hciResponse = searchSampleSupervisors("hci");
    const llmResponse = searchSampleSupervisors("llm");
    const a11yResponse = searchSampleSupervisors("a11y");

    expect(hciResponse.results[0]?.name).toBe("Leena Heikkila");
    expect(llmResponse.results[0]?.name).toBe("Aino Saarinen");
    expect(a11yResponse.results[0]?.name).toBe("Leena Heikkila");
  });

  it("falls back to the code defaults when no override exists", () => {
    const response = searchSampleSupervisors("distributed systems");

    expect(response.weights).toEqual(DEFAULT_SUPERVISOR_SEARCH_WEIGHTS);
  });
});

function calculateMockSimilarity(
  queryTokens: Set<string>,
  supervisor: { name: string; topicArea: string; activeThesisCount: number },
): number {
  if (queryTokens.size === 0) {
    return 0;
  }

  const supervisorTokens = new Set(
    tokenizeSearchText(createSearchText(supervisor.name, supervisor.topicArea, supervisor.activeThesisCount)),
  );

  let overlapCount = 0;
  for (const token of queryTokens) {
    if (supervisorTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / queryTokens.size;
}
