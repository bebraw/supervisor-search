import type { KvNamespaceBinding, SupervisorSearchEnv, SupervisorSearchWeights } from "./types.ts";

const SEARCH_WEIGHTS_STORAGE_KEY = "runtime-config:supervisor-search-weights";
const SEARCH_WEIGHT_KEYS = ["vectorSimilarity", "topicOverlap", "availability"] as const;
const SEARCH_WEIGHT_TOTAL = 1;
const SEARCH_WEIGHT_SUM_TOLERANCE = 0.0001;

export const DEFAULT_SUPERVISOR_SEARCH_WEIGHTS: SupervisorSearchWeights = {
  vectorSimilarity: 0.45,
  topicOverlap: 0.15,
  availability: 0.4,
};

export const MISSING_SEARCH_CONFIG_MESSAGE = "Runtime ranking configuration is unavailable because SUPERVISOR_SEARCH_CONFIG is not bound.";

export interface SupervisorSearchWeightsState {
  weights: SupervisorSearchWeights;
  source: "defaults" | "kv";
  updatedAt: string | null;
  canPersist: boolean;
}

interface StoredSupervisorSearchWeightsRecord {
  version: 1;
  updatedAt: string;
  weights: SupervisorSearchWeights;
}

export class SearchWeightsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchWeightsValidationError";
  }
}

export async function getSupervisorSearchWeights(env: SupervisorSearchEnv): Promise<SupervisorSearchWeights> {
  return (await loadStoredSupervisorSearchWeights(env.SUPERVISOR_SEARCH_CONFIG))?.weights ?? DEFAULT_SUPERVISOR_SEARCH_WEIGHTS;
}

export async function getSupervisorSearchWeightsState(env: SupervisorSearchEnv): Promise<SupervisorSearchWeightsState> {
  const record = await loadStoredSupervisorSearchWeights(env.SUPERVISOR_SEARCH_CONFIG);

  return {
    weights: record?.weights ?? DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
    source: record ? "kv" : "defaults",
    updatedAt: record?.updatedAt ?? null,
    canPersist: Boolean(env.SUPERVISOR_SEARCH_CONFIG),
  };
}

export async function updateSupervisorSearchWeights(env: SupervisorSearchEnv, input: unknown): Promise<SupervisorSearchWeightsState> {
  const namespace = requireSearchConfigNamespace(env);
  const weights = validateSupervisorSearchWeights(input);
  const record: StoredSupervisorSearchWeightsRecord = {
    version: 1,
    updatedAt: new Date().toISOString(),
    weights,
  };

  await namespace.put(SEARCH_WEIGHTS_STORAGE_KEY, JSON.stringify(record));

  return {
    weights: record.weights,
    source: "kv",
    updatedAt: record.updatedAt,
    canPersist: true,
  };
}

export async function resetSupervisorSearchWeights(env: SupervisorSearchEnv): Promise<SupervisorSearchWeightsState> {
  const namespace = requireSearchConfigNamespace(env);
  await namespace.delete(SEARCH_WEIGHTS_STORAGE_KEY);

  return {
    weights: DEFAULT_SUPERVISOR_SEARCH_WEIGHTS,
    source: "defaults",
    updatedAt: null,
    canPersist: true,
  };
}

export function validateSupervisorSearchWeights(input: unknown): SupervisorSearchWeights {
  if (!input || typeof input !== "object") {
    throw new SearchWeightsValidationError("Weights payload must be a JSON object.");
  }

  const candidate = input as Partial<Record<(typeof SEARCH_WEIGHT_KEYS)[number], unknown>>;
  const weights = {
    vectorSimilarity: parseWeightValue(candidate.vectorSimilarity, "vectorSimilarity"),
    topicOverlap: parseWeightValue(candidate.topicOverlap, "topicOverlap"),
    availability: parseWeightValue(candidate.availability, "availability"),
  } satisfies SupervisorSearchWeights;

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - SEARCH_WEIGHT_TOTAL) > SEARCH_WEIGHT_SUM_TOLERANCE) {
    throw new SearchWeightsValidationError("Weights must add up to 1.0.");
  }

  return weights;
}

async function loadStoredSupervisorSearchWeights(
  namespace: KvNamespaceBinding | undefined,
): Promise<StoredSupervisorSearchWeightsRecord | null> {
  if (!namespace) {
    return null;
  }

  try {
    const stored = await namespace.get(SEARCH_WEIGHTS_STORAGE_KEY, "text");
    if (!stored) {
      return null;
    }

    return parseStoredSupervisorSearchWeightsRecord(stored);
  } catch (error) {
    console.warn("Failed to load runtime supervisor search weights. Falling back to defaults.", error);
    return null;
  }
}

function parseStoredSupervisorSearchWeightsRecord(payload: string): StoredSupervisorSearchWeightsRecord | null {
  const parsed = JSON.parse(payload) as Partial<StoredSupervisorSearchWeightsRecord>;
  if (parsed.version !== 1 || typeof parsed.updatedAt !== "string") {
    return null;
  }

  try {
    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      weights: validateSupervisorSearchWeights(parsed.weights),
    };
  } catch {
    return null;
  }
}

function parseWeightValue(value: unknown, key: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new SearchWeightsValidationError(`Weight "${key}" must be a finite number.`);
  }

  if (parsed < 0 || parsed > 1) {
    throw new SearchWeightsValidationError(`Weight "${key}" must stay between 0 and 1.`);
  }

  return parsed;
}

function requireSearchConfigNamespace(env: SupervisorSearchEnv): KvNamespaceBinding {
  if (!env.SUPERVISOR_SEARCH_CONFIG) {
    throw new Error(MISSING_SEARCH_CONFIG_MESSAGE);
  }

  return env.SUPERVISOR_SEARCH_CONFIG;
}
