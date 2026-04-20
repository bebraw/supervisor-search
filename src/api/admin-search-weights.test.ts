import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSearchWeightsResponse,
  resetAdminSearchWeightsResponse,
  updateAdminSearchWeightsResponse,
} from "./admin-search-weights.ts";
import type { KvNamespaceBinding } from "../supervisors/types.ts";

describe("admin search weights API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the current admin weight state", async () => {
    const response = await createAdminSearchWeightsResponse({});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: "defaults",
      canPersist: false,
    });
  });

  it("rejects non-JSON updates", async () => {
    const response = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "text/plain",
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
        body: "nope",
      }),
      { SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Search weight updates must be sent as JSON.",
    });
  });

  it("rejects invalid JSON payloads", async () => {
    const response = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
        body: "{",
      }),
      { SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Search weight updates must be sent as JSON.",
    });
  });

  it("rejects payloads without a weights object", async () => {
    const response = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ nope: true }),
      }),
      { SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Request body must include a weights object.",
    });
  });

  it("rejects cross-site browser updates even without an origin header", async () => {
    const response = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({
          weights: {
            vectorSimilarity: 0.4,
            topicOverlap: 0.2,
            availability: 0.4,
          },
        }),
      }),
      { SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Cross-site admin requests are not allowed.",
    });
  });

  it("reports missing KV bindings for updates and resets", async () => {
    const updateResponse = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({
          weights: {
            vectorSimilarity: 0.4,
            topicOverlap: 0.2,
            availability: 0.4,
          },
        }),
      }),
      {},
    );

    expect(updateResponse.status).toBe(503);
    await expect(updateResponse.json()).resolves.toMatchObject({
      ok: false,
      error: "Runtime ranking configuration is unavailable because SUPERVISOR_SEARCH_CONFIG is not bound.",
    });

    const resetResponse = await resetAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "DELETE",
        headers: {
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
      }),
      {},
    );

    expect(resetResponse.status).toBe(503);
  });

  it("returns a generic error when KV persistence fails unexpectedly", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await updateAdminSearchWeightsResponse(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({
          weights: {
            vectorSimilarity: 0.4,
            topicOverlap: 0.2,
            availability: 0.4,
          },
        }),
      }),
      {
        SUPERVISOR_SEARCH_CONFIG: {
          async get() {
            return null;
          },
          async put() {
            throw new Error("boom");
          },
          async delete() {
            return undefined;
          },
        },
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Runtime ranking configuration is currently unavailable.",
    });
    expect(consoleError).toHaveBeenCalled();
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
