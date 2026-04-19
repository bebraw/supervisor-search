import { describe, expect, it } from "vitest";
import { buildSupervisorRecord } from "./parser.ts";
import { rankSupervisorMatches } from "./ranking.ts";

describe("rankSupervisorMatches", () => {
  it("prefers stronger topic overlap when vector scores are comparable", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const distributed = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems and edge computing",
      activeThesisCount: 4,
      rawSource: "distributed",
      importedAt,
    });
    const weaker = buildSupervisorRecord({
      name: "Aino Saarinen",
      topicArea: "Machine learning systems",
      activeThesisCount: 1,
      rawSource: "ml",
      importedAt,
    });

    const ranked = rankSupervisorMatches("distributed systems", [
      { supervisor: weaker, vectorSimilarity: 0.7 },
      { supervisor: distributed, vectorSimilarity: 0.68 },
    ]);

    expect(ranked[0]?.name).toBe("Tuomas Koski");
  });

  it("prefers lower active thesis counts when topic overlap is equal", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const lowLoad = buildSupervisorRecord({
      name: "Mikael Lahti",
      topicArea: "Cybersecurity and applied cryptography",
      activeThesisCount: 1,
      rawSource: "low",
      importedAt,
    });
    const highLoad = buildSupervisorRecord({
      name: "Leena Heikkila",
      topicArea: "Cybersecurity and applied cryptography",
      activeThesisCount: 5,
      rawSource: "high",
      importedAt,
    });

    const ranked = rankSupervisorMatches("cybersecurity cryptography", [
      { supervisor: highLoad, vectorSimilarity: 0.75 },
      { supervisor: lowLoad, vectorSimilarity: 0.75 },
    ]);

    expect(ranked[0]?.name).toBe("Mikael Lahti");
  });

  it("treats common CS aliases as topic matches", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const hci = buildSupervisorRecord({
      name: "Leena Heikkila",
      topicArea: "Human-computer interaction and accessibility research",
      activeThesisCount: 4,
      rawSource: "hci",
      importedAt,
    });
    const systems = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems and cloud infrastructure",
      activeThesisCount: 1,
      rawSource: "systems",
      importedAt,
    });

    const ranked = rankSupervisorMatches("hci", [
      { supervisor: systems, vectorSimilarity: 0.72 },
      { supervisor: hci, vectorSimilarity: 0.7 },
    ]);

    expect(ranked[0]?.name).toBe("Leena Heikkila");
  });
});
