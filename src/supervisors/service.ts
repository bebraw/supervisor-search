import { expandSearchAliases } from "./aliases.ts";
import { createSearchText, tokenizeSearchText } from "./parser.ts";
import { rankSupervisorMatches, SUPERVISOR_SEARCH_WEIGHTS } from "./ranking.ts";
import { sampleSupervisors } from "./sample-data.ts";
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_VECTOR_CANDIDATE_LIMIT,
  DEFAULT_VISIBLE_RESULT_LIMIT,
  type EmbeddingResponse,
  type SupervisorRecord,
  type SupervisorSearchEnv,
  type SupervisorSearchResponse,
  type SupervisorVectorMetadata,
} from "./types.ts";

export async function searchSupervisors(query: string, env: SupervisorSearchEnv): Promise<SupervisorSearchResponse> {
  const expandedQuery = expandSearchAliases(query);

  if (env.SUPERVISOR_SEARCH_USE_SAMPLE_DATA === "true") {
    return searchSampleSupervisors(query);
  }

  if (!env.AI || !env.SUPERVISOR_SEARCH_INDEX) {
    throw new Error("Supervisor search bindings are not configured.");
  }

  const embedding = await createEmbedding(env.AI, env.SUPERVISOR_SEARCH_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL, expandedQuery);
  const vectorResponse = await env.SUPERVISOR_SEARCH_INDEX.query(embedding, {
    topK: DEFAULT_VECTOR_CANDIDATE_LIMIT,
    returnMetadata: "all",
  });

  const candidates = vectorResponse.matches
    .map((match) => {
      const supervisor = parseSupervisorMetadata(match.metadata);
      if (!supervisor) {
        return null;
      }

      return {
        supervisor,
        vectorSimilarity: match.score,
      };
    })
    .filter((candidate): candidate is { supervisor: SupervisorRecord; vectorSimilarity: number } => candidate !== null);

  return {
    ok: true,
    query,
    source: "vectorize",
    results: rankSupervisorMatches(query, candidates).slice(0, DEFAULT_VISIBLE_RESULT_LIMIT),
    weights: SUPERVISOR_SEARCH_WEIGHTS,
  };
}

export async function createEmbedding(aiBinding: NonNullable<SupervisorSearchEnv["AI"]>, model: string, text: string): Promise<number[]> {
  const response = await aiBinding.run(model, { text });
  const embedding = coerceEmbeddingPayload(response);

  if (embedding.length === 0) {
    throw new Error("Embedding model returned an empty vector.");
  }

  return embedding;
}

export function searchSampleSupervisors(query: string): SupervisorSearchResponse {
  const queryTokens = new Set(tokenizeSearchText(expandSearchAliases(query)));
  const candidates = sampleSupervisors.map((supervisor) => ({
    supervisor,
    vectorSimilarity: calculateSampleSimilarity(queryTokens, supervisor),
  }));

  return {
    ok: true,
    query,
    source: "sample",
    results: rankSupervisorMatches(query, candidates).slice(0, DEFAULT_VISIBLE_RESULT_LIMIT),
    weights: SUPERVISOR_SEARCH_WEIGHTS,
  };
}

function calculateSampleSimilarity(queryTokens: Set<string>, supervisor: SupervisorRecord): number {
  if (queryTokens.size === 0) {
    return 0;
  }

  const supervisorTokens = new Set(
    tokenizeSearchText(createSearchText(supervisor.name, supervisor.topicArea, supervisor.activeThesisCount)),
  );

  let overlapCount = 0;
  for (const token of queryTokens) {
    if (supervisorTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / queryTokens.size;
}

function coerceEmbeddingPayload(payload: EmbeddingResponse | { result?: EmbeddingResponse }): number[] {
  const response = extractEmbeddingResponse(payload);
  const embedding = response.data?.[0];

  if (!Array.isArray(embedding)) {
    return [];
  }

  return embedding.map((value) => Number(value));
}

function extractEmbeddingResponse(payload: EmbeddingResponse | { result?: EmbeddingResponse }): EmbeddingResponse {
  if ("data" in payload) {
    return payload;
  }

  return payload.result ?? { data: [] };
}

function parseSupervisorMetadata(metadata: unknown): SupervisorRecord | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const candidate = metadata as Partial<SupervisorVectorMetadata>;

  if (
    typeof candidate.supervisorId !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.topicArea !== "string" ||
    typeof candidate.searchText !== "string" ||
    typeof candidate.sourceFingerprint !== "string" ||
    typeof candidate.importedAt !== "string" ||
    typeof candidate.activeThesisCount !== "number"
  ) {
    return null;
  }

  return {
    supervisorId: candidate.supervisorId,
    name: candidate.name,
    topicArea: candidate.topicArea,
    activeThesisCount: candidate.activeThesisCount,
    searchText: candidate.searchText,
    sourceFingerprint: candidate.sourceFingerprint,
    importedAt: candidate.importedAt,
  };
}
