import { describe, expect, it } from "vitest";
import { createHealthResponse } from "./health";

describe("createHealthResponse", () => {
  it("returns the stable JSON payload for health checks", async () => {
    const response = createHealthResponse(["/", "/api/search", "/api/health"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "supervisor-search-worker",
      routes: ["/", "/api/search", "/api/health"],
    });
  });
});
