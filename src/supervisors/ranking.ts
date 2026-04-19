import { expandSearchAliases } from "./aliases";
import { createSearchText, tokenizeSearchText } from "./parser";
import type { RankedSupervisorResult, SupervisorRecord, SupervisorSearchSignals } from "./types";

export const SUPERVISOR_SEARCH_WEIGHTS = {
  vectorSimilarity: 0.65,
  topicOverlap: 0.25,
  availability: 0.1,
} as const;

const AVAILABILITY_ZERO_SCORE_AT = 10;

export function rankSupervisorMatches(
  query: string,
  candidates: Array<{ supervisor: SupervisorRecord; vectorSimilarity: number }>,
): RankedSupervisorResult[] {
  return candidates
    .map(({ supervisor, vectorSimilarity }) => {
      const signals: SupervisorSearchSignals = {
        vectorSimilarity: clampScore(vectorSimilarity),
        topicOverlap: calculateTopicOverlap(query, supervisor),
        availability: calculateAvailability(supervisor.activeThesisCount),
      };

      const score =
        signals.vectorSimilarity * SUPERVISOR_SEARCH_WEIGHTS.vectorSimilarity +
        signals.topicOverlap * SUPERVISOR_SEARCH_WEIGHTS.topicOverlap +
        signals.availability * SUPERVISOR_SEARCH_WEIGHTS.availability;

      return {
        supervisorId: supervisor.supervisorId,
        name: supervisor.name,
        topicArea: supervisor.topicArea,
        activeThesisCount: supervisor.activeThesisCount,
        score: Number(score.toFixed(4)),
        signals,
      };
    })
    .sort(
      (left, right) => right.score - left.score || left.activeThesisCount - right.activeThesisCount || left.name.localeCompare(right.name),
    );
}

export function calculateTopicOverlap(query: string, supervisor: SupervisorRecord): number {
  const queryTokens = new Set(tokenizeSearchText(expandSearchAliases(query)));
  if (queryTokens.size === 0) {
    return 0;
  }

  const topicTokens = new Set(tokenizeSearchText(supervisor.topicArea));
  const searchTokens = new Set(tokenizeSearchText(createSearchText(supervisor.name, supervisor.topicArea, supervisor.activeThesisCount)));

  let overlapCount = 0;

  for (const token of queryTokens) {
    if (topicTokens.has(token) || searchTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return clampScore(overlapCount / queryTokens.size);
}

export function calculateAvailability(activeThesisCount: number): number {
  return clampScore(1 - activeThesisCount / AVAILABILITY_ZERO_SCORE_AT);
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
