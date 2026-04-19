export const DEFAULT_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";
export const DEFAULT_VECTOR_CANDIDATE_LIMIT = 50;
export const DEFAULT_VISIBLE_RESULT_LIMIT = 10;
export const MINIMUM_QUERY_LENGTH = 2;

export interface SupervisorRecord {
  supervisorId: string;
  name: string;
  topicArea: string;
  activeThesisCount: number;
  searchText: string;
  sourceFingerprint: string;
  importedAt: string;
}

export interface SupervisorSearchSignals {
  vectorSimilarity: number;
  topicOverlap: number;
  availability: number;
}

export interface RankedSupervisorResult {
  supervisorId: string;
  name: string;
  topicArea: string;
  activeThesisCount: number;
  score: number;
  signals: SupervisorSearchSignals;
}

export interface SupervisorSearchResponse {
  ok: true;
  query: string;
  source: "sample" | "vectorize";
  results: RankedSupervisorResult[];
  weights: {
    vectorSimilarity: number;
    topicOverlap: number;
    availability: number;
  } | null;
}

export interface EmbeddingResponse {
  shape?: number[];
  data: number[][];
}

export interface AiBinding {
  run(model: string, input: { text: string | string[] }): Promise<EmbeddingResponse>;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: unknown;
}

export interface VectorQueryResult {
  matches: VectorMatch[];
}

export interface VectorizeBinding {
  query(
    vector: number[] | Float32Array | Float64Array,
    options?: {
      topK?: number;
      returnMetadata?: "none" | "indexed" | "all";
      returnValues?: boolean;
    },
  ): Promise<VectorQueryResult>;
}

export interface SupervisorSearchEnv {
  AI?: AiBinding;
  SUPERVISOR_SEARCH_INDEX?: VectorizeBinding;
  SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME?: string;
  SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD?: string;
  SUPERVISOR_SEARCH_EMBEDDING_MODEL?: string;
  SUPERVISOR_SEARCH_RATE_LIMIT_MAX_REQUESTS?: string;
  SUPERVISOR_SEARCH_RATE_LIMIT_WINDOW_MS?: string;
  SUPERVISOR_SEARCH_USE_SAMPLE_DATA?: string;
}

export type SupervisorVectorMetadata = SupervisorRecord;
