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
    routes: ["/", "/admin", "/api/search", "/api/admin/search-weights", "/api/health"],
  });
});

test("returns live search results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox", { name: "Search supervisors" }).fill("distributed systems");

  await expect(page.locator("#search-status")).toHaveText("4 results");
  await expect(page.getByRole("heading", { level: 3, name: "Tuomas Koski" })).toBeVisible();
  await expect(page).toHaveURL(/[\?&]q=distributed\+systems|[\?&]q=distributed%20systems/);
});

test("restores the shared query from the browser URL", async ({ page }) => {
  await page.goto("/?q=distributed%20systems");

  await expect(page.getByRole("searchbox", { name: "Search supervisors" })).toHaveValue("distributed systems");
  await expect(page.locator("#search-status")).toHaveText("4 results");
  await expect(page.getByRole("heading", { level: 3, name: "Tuomas Koski" })).toBeVisible();
});

test("keeps the search bar visible while scrolling through results", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 320 });
  await page.goto("/?q=distributed%20systems");

  const searchbox = page.getByRole("searchbox", { name: "Search supervisors" });

  await expect(searchbox).toHaveValue("distributed systems");
  await expect(page.locator("#search-status")).toHaveText("4 results");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(0);

  const initialTop = await searchbox.evaluate((element) => element.getBoundingClientRect().top);

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator("#search-results li").last()).toBeInViewport();
  await expect(searchbox).toBeInViewport();

  const scrolledTop = await searchbox.evaluate((element) => element.getBoundingClientRect().top);

  expect(scrolledTop).toBeGreaterThanOrEqual(0);
  expect(scrolledTop).toBeLessThan(48);
  expect(scrolledTop).toBeLessThan(initialTop);
});

test("serves the generated stylesheet", async ({ request }) => {
  const response = await request.get("/styles.css");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/css");
  await expect(response.text()).resolves.toContain("--color-app-canvas:");
});
