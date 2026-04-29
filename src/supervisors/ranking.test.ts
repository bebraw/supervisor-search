import { describe, expect, it } from "vitest";
import { buildSupervisorRecord } from "./parser.ts";
import { rankSupervisorMatches } from "./ranking.ts";

describe("rankSupervisorMatches", () => {
  it("prefers stronger query matches over lower thesis load", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const distributed = buildSupervisorRecord({
      name: "Tuomas Koski",
      topicArea: "Distributed systems and edge computing",
      activeThesisCount: 7,
      rawSource: "distributed",
      importedAt,
    });
    const weaker = buildSupervisorRecord({
      name: "Aino Saarinen",
      topicArea: "Machine learning systems",
      activeThesisCount: 6,
      rawSource: "ml",
      importedAt,
    });

    const ranked = rankSupervisorMatches("distributed systems", [
      { supervisor: weaker, vectorSimilarity: 0.4 },
      { supervisor: distributed, vectorSimilarity: 0.95 },
    ]);

    expect(ranked[0]?.name).toBe("Tuomas Koski");
  });

  it("uses lower thesis load to break ties between equally relevant matches", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const lowerLoad = buildSupervisorRecord({
      name: "Mikael Lahti",
      topicArea: "Cybersecurity and applied cryptography",
      activeThesisCount: 2,
      rawSource: "low",
      importedAt,
    });
    const higherLoad = buildSupervisorRecord({
      name: "Leena Heikkila",
      topicArea: "Cybersecurity and applied cryptography",
      activeThesisCount: 5,
      rawSource: "high",
      importedAt,
    });

    const ranked = rankSupervisorMatches("cybersecurity cryptography", [
      { supervisor: higherLoad, vectorSimilarity: 0.75 },
      { supervisor: lowerLoad, vectorSimilarity: 0.75 },
    ]);

    expect(ranked[0]?.name).toBe("Mikael Lahti");
  });

  it("excludes candidates without topic overlap", () => {
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
      { supervisor: systems, vectorSimilarity: 0 },
      { supervisor: hci, vectorSimilarity: 0.7 },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.name).toBe("Leena Heikkila");
  });

  it("does not use supervisor names as topic matches", () => {
    const importedAt = "2026-04-19T12:00:00.000Z";
    const supervisor = buildSupervisorRecord({
      name: "Cloud Security",
      topicArea: "Educational technology and learner analytics",
      activeThesisCount: 1,
      rawSource: "name-only",
      importedAt,
    });

    const ranked = rankSupervisorMatches("cloud security", [{ supervisor, vectorSimilarity: 0.99 }]);

    expect(ranked).toEqual([]);
  });
});
