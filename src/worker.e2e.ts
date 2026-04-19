import { expect, test } from "@playwright/test";

test("challenges invalid browser credentials", async ({ browser }) => {
  const guestContext = await browser.newContext({
    httpCredentials: {
      username: "wrong",
      password: "creds",
    },
  });
  const guestPage = await guestContext.newPage();

  const response = await guestPage.goto("http://127.0.0.1:8788/");

  expect(response?.status()).toBe(401);
  await guestContext.close();
});

test("renders the supervisor search home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Find an MSc Supervisor" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search supervisors" })).toBeVisible();
  await expect(page.getByPlaceholder("Type a topic, method, or research area")).toBeVisible();
});

test("serves the health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    ok: true,
    name: "supervisor-search-worker",
    routes: ["/", "/api/search", "/api/health"],
  });
});

test("returns live search results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search supervisors" }).fill("distributed systems");

  await expect(page.locator("#search-status")).toHaveText("4 results");
  await expect(page.getByRole("heading", { level: 3, name: "Tuomas Koski" })).toBeVisible();
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:");
});
