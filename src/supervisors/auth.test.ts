import { describe, expect, it } from "vitest";
import { ensureAuthorizedRequest } from "./auth.ts";

const testEnv = {
  SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME: "student",
  SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD: "secret",
};

function createAuthorizationHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("ensureAuthorizedRequest", () => {
  it("returns a configuration error when auth secrets are missing", () => {
    const response = ensureAuthorizedRequest(new Request("http://example.com/"), {});

    expect(response?.status).toBe(503);
  });

  it("returns a challenge for missing credentials", async () => {
    const response = ensureAuthorizedRequest(new Request("http://example.com/"), testEnv);

    expect(response?.status).toBe(401);
    expect(response?.headers.get("www-authenticate")).toContain("Basic");
  });

  it("rejects malformed credentials", () => {
    const response = ensureAuthorizedRequest(
      new Request("http://example.com/", {
        headers: {
          authorization: "Basic definitely-not-base64",
        },
      }),
      testEnv,
    );

    expect(response?.status).toBe(401);
  });

  it("accepts valid credentials", () => {
    const response = ensureAuthorizedRequest(
      new Request("http://example.com/", {
        headers: {
          authorization: createAuthorizationHeader("student", "secret"),
        },
      }),
      testEnv,
    );

    expect(response).toBeNull();
  });
});
