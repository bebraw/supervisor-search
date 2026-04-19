import { describe, expect, it } from "vitest";
import { renderHomePage } from "./home";

describe("renderHomePage", () => {
  it("renders the supervisor search surface and stylesheet wiring", () => {
    const html = renderHomePage();

    expect(html).toContain("Find an MSc Supervisor");
    expect(html).toContain("Type a topic, method, or research area");
    expect(html).toContain('rel="stylesheet" href="/styles.css"');
  });
});
