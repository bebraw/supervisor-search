import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimitState } from "./rate-limit";
import worker, { handleRequest } from "./worker";
import { ensureGeneratedStylesheet } from "./test-support";
import type { KvNamespaceBinding } from "./supervisors/types";

ensureGeneratedStylesheet();

beforeEach(() => {
  resetRateLimitState();
});

function createAuthorizationHeader(username = "student", password = "secret"): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function createTestEnv(overrides: Record<string, unknown> = {}) {
  return {
    SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME: "student",
    SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD: "secret",
    SUPERVISOR_SEARCH_USE_SAMPLE_DATA: "true",
    ...overrides,
  };
}

describe("worker", () => {
  it("requires authentication for the home page", async () => {
    const response = await handleRequest(new Request("http://example.com/"), createTestEnv());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
  });

  it("renders the supervisor search home page for authorized requests", async () => {
    const response = await handleRequest(
      new Request("http://example.com/", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");

    const body = await response.text();
    expect(body).toContain("Find an MSc Supervisor");
    expect(body).toContain("Type a topic, method, or research area");
  });

  it("returns a JSON health response", async () => {
    const response = await handleRequest(new Request("http://example.com/api/health"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "supervisor-search-worker",
      routes: ["/", "/admin", "/api/search", "/api/admin/search-weights", "/api/health"],
    });
  });

  it("returns ranked supervisor matches for the search API", async () => {
    const response = await handleRequest(
      new Request("http://example.com/api/search?q=distributed%20systems", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.results[0]).toMatchObject({
      name: "Tuomas Koski",
    });
  });

  it("throttles repeated search requests from the same client", async () => {
    const throttledEnv = {
      ...createTestEnv(),
      SUPERVISOR_SEARCH_RATE_LIMIT_MAX_REQUESTS: "1",
      SUPERVISOR_SEARCH_RATE_LIMIT_WINDOW_MS: "60000",
    };
    const headers = {
      authorization: createAuthorizationHeader(),
      "cf-connecting-ip": "203.0.113.10",
    };

    const firstResponse = await handleRequest(
      new Request("http://example.com/api/search?q=distributed%20systems", { headers }),
      throttledEnv,
    );
    expect(firstResponse.status).toBe(200);

    const secondResponse = await handleRequest(
      new Request("http://example.com/api/search?q=distributed%20systems", { headers }),
      throttledEnv,
    );

    expect(secondResponse.status).toBe(429);
    expect(secondResponse.headers.get("retry-after")).toBeTruthy();
    await expect(secondResponse.json()).resolves.toMatchObject({
      ok: false,
      error: "Too many search requests. Try again soon.",
    });
  });

  it("returns a not found page for unknown routes", async () => {
    const response = await handleRequest(
      new Request("http://example.com/missing", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(404);

    const body = await response.text();
    expect(body).toContain("Not Found");
    expect(body).toContain("/missing");
  });

  it("exposes the same behavior through the worker fetch entrypoint", async () => {
    const response = await worker.fetch(new Request("http://example.com/api/health"), createTestEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("serves generated styles", async () => {
    const response = await handleRequest(new Request("http://example.com/styles.css"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    await expect(response.text()).resolves.toContain("--color-app-canvas:#fff");
  });

  it("serves the external app script with security headers", async () => {
    const response = await handleRequest(new Request("http://example.com/app.js"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await response.text();
    expect(body).toContain('fetch("/api/search?q=" + encodeURIComponent(query)');
    expect(body).toContain("window.history.replaceState");
  });

  it("renders the admin page for authorized requests", async () => {
    const response = await handleRequest(
      new Request("http://example.com/admin", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Search Ranking Admin");
  });

  it("serves the admin script with security headers", async () => {
    const response = await handleRequest(new Request("http://example.com/admin.js"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.text()).resolves.toContain('fetch("/api/admin/search-weights"');
  });

  it("returns default admin weights when KV is not configured", async () => {
    const response = await handleRequest(
      new Request("http://example.com/api/admin/search-weights", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: "defaults",
      canPersist: false,
      weights: {
        vectorSimilarity: 0.45,
        topicOverlap: 0.15,
        availability: 0.4,
      },
    });
  });

  it("updates runtime weights through the admin API when KV is configured", async () => {
    const kv = createMemoryKvNamespace();
    const env = createTestEnv({ SUPERVISOR_SEARCH_CONFIG: kv });
    const headers = {
      authorization: createAuthorizationHeader(),
      "content-type": "application/json",
      origin: "http://example.com",
      "sec-fetch-site": "same-origin",
    };

    const updateResponse = await handleRequest(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          weights: {
            vectorSimilarity: 0.4,
            topicOverlap: 0.2,
            availability: 0.4,
          },
        }),
      }),
      env,
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      ok: true,
      source: "kv",
      canPersist: true,
      weights: {
        vectorSimilarity: 0.4,
        topicOverlap: 0.2,
        availability: 0.4,
      },
    });

    const searchResponse = await handleRequest(
      new Request("http://example.com/api/search?q=distributed%20systems", {
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      env,
    );

    await expect(searchResponse.json()).resolves.toMatchObject({
      ok: true,
      weights: {
        vectorSimilarity: 0.4,
        topicOverlap: 0.2,
        availability: 0.4,
      },
    });
  });

  it("rejects cross-origin admin mutations", async () => {
    const response = await handleRequest(
      new Request("http://example.com/api/admin/search-weights", {
        method: "PUT",
        headers: {
          authorization: createAuthorizationHeader(),
          "content-type": "application/json",
          origin: "http://evil.example",
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
      createTestEnv({ SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Cross-origin admin requests are not allowed.",
    });
  });

  it("returns 405 for unsupported admin API methods", async () => {
    const response = await handleRequest(
      new Request("http://example.com/api/admin/search-weights", {
        method: "POST",
        headers: {
          authorization: createAuthorizationHeader(),
        },
      }),
      createTestEnv({ SUPERVISOR_SEARCH_CONFIG: createMemoryKvNamespace() }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT, DELETE");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Method not allowed.",
    });
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
