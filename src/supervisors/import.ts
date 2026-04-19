import { parseSupervisorsHtml } from "./parser.ts";
import type { SupervisorRecord } from "./types.ts";

export const DEFAULT_IMPORT_MINIMUM_RETENTION_RATIO = 0.8;
export const DEFAULT_IMPORT_MAX_DELETE_RATIO = 0.2;

export interface SupervisorVectorDocument {
  id: string;
  values: number[];
  metadata: SupervisorRecord;
}

export interface SupervisorImportPlan {
  supervisors: SupervisorRecord[];
  vectors: SupervisorVectorDocument[];
  idsToDelete: string[];
  vectorNdjson: string;
}

export interface SupervisorImportGuardrails {
  minimumSupervisorCount?: number;
  maxDeleteRatio?: number;
  allowLargeDelete?: boolean;
}

export function parseSupervisorSnapshot(html: string, importedAt = new Date().toISOString()): SupervisorRecord[] {
  return parseSupervisorsHtml(html, importedAt);
}

export function planSupervisorImport(supervisors: SupervisorRecord[], embeddings: number[][], existingIds: string[]): SupervisorImportPlan {
  if (supervisors.length !== embeddings.length) {
    throw new Error("Supervisor count and embedding count must match.");
  }

  const vectors = supervisors.map((supervisor, index) => ({
    id: supervisor.supervisorId,
    values: embeddings[index] ?? [],
    metadata: supervisor,
  }));

  const nextIds = new Set(supervisors.map((supervisor) => supervisor.supervisorId));
  const idsToDelete = existingIds.filter((id) => !nextIds.has(id));
  const vectorNdjson = vectors.map((vector) => JSON.stringify(vector)).join("\n");

  return {
    supervisors,
    vectors,
    idsToDelete,
    vectorNdjson,
  };
}

export function validateSupervisorImport(
  supervisors: SupervisorRecord[],
  existingIds: string[],
  idsToDelete: string[],
  guardrails: SupervisorImportGuardrails = {},
): void {
  const inferredMinimumSupervisorCount = guardrails.minimumSupervisorCount ?? inferMinimumSupervisorCount(existingIds.length);

  if (inferredMinimumSupervisorCount > 0 && supervisors.length < inferredMinimumSupervisorCount) {
    throw new Error(
      `Parsed ${supervisors.length} supervisors, below the safety floor of ${inferredMinimumSupervisorCount}. ` +
        "Inspect the parser output or rerun with --minimum-supervisor-count after confirming the new snapshot.",
    );
  }

  if (guardrails.allowLargeDelete || existingIds.length === 0 || idsToDelete.length === 0) {
    return;
  }

  const maxDeleteRatio = guardrails.maxDeleteRatio ?? DEFAULT_IMPORT_MAX_DELETE_RATIO;
  const deleteRatio = idsToDelete.length / existingIds.length;

  if (deleteRatio > maxDeleteRatio) {
    throw new Error(
      `Import would delete ${idsToDelete.length} of ${existingIds.length} existing supervisors (${formatPercent(deleteRatio)}), ` +
        `above the safety threshold of ${formatPercent(maxDeleteRatio)}. ` +
        "Rerun with --allow-large-delete or raise --max-delete-ratio after confirming the parser output.",
    );
  }
}

function inferMinimumSupervisorCount(existingSupervisorCount: number): number {
  if (existingSupervisorCount === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(existingSupervisorCount * DEFAULT_IMPORT_MINIMUM_RETENTION_RATIO));
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
