import { parseSupervisorsHtml } from "./parser.ts";
import type { SupervisorRecord } from "./types.ts";

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
