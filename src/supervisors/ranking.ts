import { expandSearchAliases } from "./aliases.ts";
import { DEFAULT_SUPERVISOR_SEARCH_WEIGHTS } from "./config.ts";
import { createSearchText, tokenizeSearchText } from "./parser.ts";
import type { RankedSupervisorResult, SupervisorRecord, SupervisorSearchSignals, SupervisorSearchWeights } from "./types.ts";

export const SUPERVISOR_SEARCH_WEIGHTS = DEFAULT_SUPERVISOR_SEARCH_WEIGHTS;

const AVAILABILITY_ZERO_SCORE_AT = 10;

export function rankSupervisorMatches(
  query: string,
  candidates: Array<{ supervisor: SupervisorRecord; vectorSimilarity: number }>,
  weights: SupervisorSearchWeights = SUPERVISOR_SEARCH_WEIGHTS,
): RankedSupervisorResult[] {
  return candidates
    .map(({ supervisor, vectorSimilarity }) => {
      const signals: SupervisorSearchSignals = {
        vectorSimilarity: clampScore(vectorSimilarity),
        topicOverlap: calculateTopicOverlap(query, supervisor),
        availability: calculateAvailability(supervisor.activeThesisCount),
      };
      const matchesQuery = signals.vectorSimilarity > 0 || signals.topicOverlap > 0;

      const score =
        signals.vectorSimilarity * weights.vectorSimilarity +
        signals.topicOverlap * weights.topicOverlap +
        signals.availability * weights.availability;

      return {
        supervisorId: supervisor.supervisorId,
        name: supervisor.name,
        topicArea: supervisor.topicArea,
        activeThesisCount: supervisor.activeThesisCount,
        score: Number(score.toFixed(4)),
        signals,
        matchesQuery,
      };
    })
    .sort((left, right) => {
      return (
        Number(right.matchesQuery) - Number(left.matchesQuery) ||
        right.score - left.score ||
        left.activeThesisCount - right.activeThesisCount ||
        left.name.localeCompare(right.name)
      );
    })
    .map(({ matchesQuery: _matchesQuery, ...result }) => result);
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
