import { describe, expect, it } from "vitest";
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
            topK: 20,
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

  it("throws when live bindings are missing", async () => {
    await expect(searchSupervisors("distributed systems", {})).rejects.toThrow("Supervisor search bindings are not configured.");
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

    expect(hciResponse.results[0]?.name).toBe("Leena Heikkila");
    expect(llmResponse.results[0]?.name).toBe("Aino Saarinen");
  });
});
