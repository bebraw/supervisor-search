import { describe, expect, it } from "vitest";
import { renderAdminPage } from "./admin";

describe("renderAdminPage", () => {
  it("renders the admin surface and script wiring", () => {
    const html = renderAdminPage();

    expect(html).toContain("Search Ranking Admin");
    expect(html).toContain("Save weights");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
    expect(html).toContain('<script src="/admin.js" defer></script>');
  });
});
