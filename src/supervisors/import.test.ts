import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseSupervisorSnapshot, planSupervisorImport, validateSupervisorImport } from "./import.ts";
import { buildSupervisorRecord } from "./parser.ts";

describe("planSupervisorImport", () => {
  it("plans upserts and deletions for a full-snapshot refresh", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const aino = buildSupervisorRecord({
      name: "Aino Saarinen",
      topicArea: "Machine learning systems",
      activeThesisCount: 2,
      rawSource: "aino",
      importedAt,
    });
    const tuomas = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems",
      activeThesisCount: 3,
      rawSource: "tuomas",
      importedAt,
    });

    const plan = planSupervisorImport(
      [aino, tuomas],
      [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
      [aino.supervisorId, "removed-supervisor"],
    );

    expect(plan.vectors).toHaveLength(2);
    expect(plan.idsToDelete).toEqual(["removed-supervisor"]);
    expect(plan.vectorNdjson).toContain(aino.supervisorId);
    expect(plan.vectorNdjson).toContain(tuomas.supervisorId);
  });

  it("throws when supervisor and embedding counts diverge", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const aino = buildSupervisorRecord({
      name: "Aino Saarinen",
      topicArea: "Machine learning systems",
      activeThesisCount: 2,
      rawSource: "aino",
      importedAt,
    });

    expect(() => planSupervisorImport([aino], [], [])).toThrow("Supervisor count and embedding count must match.");
  });
});

describe("parseSupervisorSnapshot", () => {
  it("delegates to the parser for snapshot extraction", () => {
    const supervisors = parseSupervisorSnapshot(
      `
        <article>
          <h2>Leena Heikkila</h2>
          <p>Topic area: Accessibility and HCI</p>
          <p>Current theses: 4</p>
        </article>
      `,
      "2026-04-19T12:00:00.000Z",
    );

    expect(supervisors[0]).toMatchObject({
      name: "Leena Heikkila",
      activeThesisCount: 4,
    });
  });

  it("parses the sanitized supervisor snapshot fixture used for import testing", async () => {
    const html = await readFile(new URL("./fixtures/sanitized-supervisor-snapshot.html", import.meta.url), "utf8");
    const importedAt = "2026-04-19T12:00:00.000Z";

    const supervisors = parseSupervisorSnapshot(html, importedAt);

    expect(supervisors).toHaveLength(105);
    expect(supervisors[0]).toMatchObject({
      name: "Supervisor 01",
      activeThesisCount: 0,
      topicArea: "Programming, Algorithms, Evolutionary computation, Computer generated and digital holography",
      importedAt,
    });
    expect(supervisors[77]).toMatchObject({
      name: "Supervisor 78 (elec)",
      activeThesisCount: 2,
    });
    expect(supervisors.at(-1)).toMatchObject({
      name: "Supervisor 105 (elec)",
      activeThesisCount: 0,
      topicArea: "Coding and information theory, mathematical foundations of ICT",
    });
    expect(supervisors.every((supervisor) => supervisor.supervisorId.length <= 64)).toBe(true);
  });
});

describe("validateSupervisorImport", () => {
  it("rejects suspiciously small snapshots relative to the existing index", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const aino = buildSupervisorRecord({
      name: "Aino Saarinen",
      topicArea: "Machine learning systems",
      activeThesisCount: 2,
      rawSource: "aino",
      importedAt,
    });

    expect(() => validateSupervisorImport([aino], ["one", "two", "three", "four", "five"], [], {})).toThrow("below the safety floor");
  });

  it("rejects large delete sets unless explicitly allowed", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const supervisors = [
      buildSupervisorRecord({
        name: "Aino Saarinen",
        topicArea: "Machine learning systems",
        activeThesisCount: 2,
        rawSource: "aino",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Tuomas Koski",
        topicArea: "Distributed systems",
        activeThesisCount: 3,
        rawSource: "tuomas",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Leena Heikkila",
        topicArea: "Accessibility and HCI",
        activeThesisCount: 4,
        rawSource: "leena",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Mikael Lahti",
        topicArea: "Cybersecurity",
        activeThesisCount: 1,
        rawSource: "mikael",
        importedAt,
      }),
    ];

    expect(() => validateSupervisorImport(supervisors, ["1", "2", "3", "4", "5"], ["2", "3"], {})).toThrow("above the safety threshold");
  });

  it("allows explicit overrides for confirmed large changes", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const supervisors = [
      buildSupervisorRecord({
        name: "Aino Saarinen",
        topicArea: "Machine learning systems",
        activeThesisCount: 2,
        rawSource: "aino",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Tuomas Koski",
        topicArea: "Distributed systems",
        activeThesisCount: 3,
        rawSource: "tuomas",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Leena Heikkila",
        topicArea: "Accessibility and HCI",
        activeThesisCount: 4,
        rawSource: "leena",
        importedAt,
      }),
      buildSupervisorRecord({
        name: "Mikael Lahti",
        topicArea: "Cybersecurity",
        activeThesisCount: 1,
        rawSource: "mikael",
        importedAt,
      }),
    ];

    expect(() =>
      validateSupervisorImport(supervisors, ["1", "2", "3", "4", "5"], ["2", "3"], {
        allowLargeDelete: true,
        minimumSupervisorCount: 4,
      }),
    ).not.toThrow();
  });
});
