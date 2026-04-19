import { describe, expect, it } from "vitest";
import { buildSupervisorRecord, parseSupervisorsHtml } from "./parser.ts";

describe("parseSupervisorsHtml", () => {
  it("extracts supervisors from a table-like HTML snapshot", () => {
    const html = `
      <table>
        <thead>
          <tr><th>Name</th><th>Current theses</th><th>Topic area</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="/aino">Aino Saarinen</a></td>
            <td>2</td>
            <td>Machine learning systems and LLM evaluation</td>
          </tr>
          <tr>
            <td><a href="/tuomas">Tuomas Koski</a></td>
            <td>3</td>
            <td>Distributed systems and dependable cloud infrastructure</td>
          </tr>
        </tbody>
      </table>
    `;

    const supervisors = parseSupervisorsHtml(html, "2026-04-19T12:00:00.000Z");

    expect(supervisors).toHaveLength(2);
    expect(supervisors[0]).toMatchObject({
      name: "Aino Saarinen",
      activeThesisCount: 2,
      topicArea: "Machine learning systems and LLM evaluation",
      importedAt: "2026-04-19T12:00:00.000Z",
    });
    expect(supervisors[0].searchText).toContain("Currently supervising 2 active MSc theses.");
  });

  it("builds Vectorize-safe supervisor ids for long topic areas", () => {
    const supervisor = buildSupervisorRecord({
      name: "Supervisor 01",
      topicArea: "Programming, Algorithms, Evolutionary computation, Computer generated and digital holography",
      activeThesisCount: 0,
      rawSource: "long-topic",
      importedAt: "2026-04-19T12:00:00.000Z",
    });

    expect(supervisor.supervisorId.length).toBeLessThanOrEqual(64);
    expect(supervisor.supervisorId).toMatch(/^supervisor-supervisor-01-[0-9a-f]{8}$/);
  });
});
