import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
  MISSING_SEARCH_CONFIG_MESSAGE,
  SearchWeightsValidationError,
  getSupervisorSearchWeights,
  getSupervisorSearchWeightsState,
  resetSupervisorSearchWeights,
  updateSupervisorSearchWeights,
  validateSupervisorSearchWeights,
} from "./config.ts";
import type { KvNamespaceBinding } from "./types.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateSupervisorSearchWeights", () => {
  it("accepts valid weight sets that total one", () => {
    expect(
      validateSupervisorSearchWeights({
        vectorSimilarity: 0.5,
        topicOverlap: 0.1,
        availability: 0.4,
      }),
    ).toEqual({
      vectorSimilarity: 0.5,
      topicOverlap: 0.1,
      availability: 0.4,
    });
  });

  it("rejects weights that do not add up to one", () => {
    expect(() =>
      validateSupervisorSearchWeights({
        vectorSimilarity: 0.5,
        topicOverlap: 0.2,
        availability: 0.4,
      }),
    ).toThrowError(new SearchWeightsValidationError("Weights must add up to 1.0."));
  });

  it("rejects non-finite and out-of-range values", () => {
    expect(() =>
      validateSupervisorSearchWeights({
        vectorSimilarity: "nope",
        topicOverlap: 0.2,
        availability: 0.8,
      }),
    ).toThrow('Weight "vectorSimilarity" must be a finite number.');

    expect(() =>
      validateSupervisorSearchWeights({
        vectorSimilarity: 1.2,
        topicOverlap: -0.2,
        availability: 0,
      }),
    ).toThrow('Weight "vectorSimilarity" must stay between 0 and 1.');
  });
});

describe("runtime search weight state", () => {
  it("returns defaults when KV is not configured", async () => {
    await expect(getSupervisorSearchWeightsState({})).resolves.toEqual({
      weights: DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
      source: "defaults",
      updatedAt: null,
      canPersist: false,
    });
  });

  it("stores, reads, and resets runtime overrides", async () => {
    const kv = createMemoryKvNamespace();
    const env = { SUPERVISOR_SEARCH_CONFIG: kv };

    const stored = await updateSupervisorSearchWeights(env, {
      vectorSimilarity: 0.35,
      topicOverlap: 0.25,
      availability: 0.4,
    });

    expect(stored).toMatchObject({
      weights: {
        vectorSimilarity: 0.35,
        topicOverlap: 0.25,
        availability: 0.4,
      },
      source: "kv",
      canPersist: true,
    });
    expect(stored.updatedAt).toBeTruthy();

    await expect(getSupervisorSearchWeightsState(env)).resolves.toMatchObject({
      weights: stored.weights,
      source: "kv",
      canPersist: true,
    });

    await expect(resetSupervisorSearchWeights(env)).resolves.toEqual({
      weights: DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
      source: "defaults",
      updatedAt: null,
      canPersist: true,
    });
  });

  it("rejects writes when the KV binding is unavailable", async () => {
    await expect(
      updateSupervisorSearchWeights(
        {},
        {
          vectorSimilarity: 0.45,
          topicOverlap: 0.15,
          availability: 0.4,
        },
      ),
    ).rejects.toThrow(MISSING_SEARCH_CONFIG_MESSAGE);
  });

  it("falls back to defaults when the stored payload is invalid", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await getSupervisorSearchWeightsState({
      SUPERVISOR_SEARCH_CONFIG: {
        async get() {
          return "{";
        },
        async put() {
          return undefined;
        },
        async delete() {
          return undefined;
        },
      },
    });

    expect(state).toEqual({
      weights: DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
      source: "defaults",
      updatedAt: null,
      canPersist: true,
    });
    expect(consoleWarn).toHaveBeenCalled();
  });

  it("ignores stored records with invalid weight values", async () => {
    await expect(
      getSupervisorSearchWeights({
        SUPERVISOR_SEARCH_CONFIG: {
          async get() {
            return JSON.stringify({
              version: 1,
              updatedAt: "2026-04-20T10:00:00.000Z",
              weights: {
                vectorSimilarity: 0.45,
                topicOverlap: 0.15,
                availability: 2,
              },
            });
          },
          async put() {
            return undefined;
          },
          async delete() {
            return undefined;
          },
        },
      }),
    ).resolves.toEqual(DEFAULT_SUPERVISOR_SEARCH_WEIGHTS);
  });
});

function createMemoryKvNamespace(): KvNamespaceBinding {
  const store = new Map<string, string>();

  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
