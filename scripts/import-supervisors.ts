import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseSupervisorSnapshot, planSupervisorImport, validateSupervisorImport } from "../src/supervisors/import.ts";
import { DEFAULT_EMBEDDING_MODEL } from "../src/supervisors/types.ts";

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result: T;
}

interface VectorListResponse {
  vectors?: string[];
  nextCursor?: string | null;
}

interface IndexInfoResponse {
  dimensions?: number;
}

const VECTORIZE_PAGE_SIZE = 1_000;
const EMBEDDING_BATCH_SIZE = 100;
const CLOUDLFARE_ERROR_BODY_LIMIT = 500;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      "account-id": { type: "string" },
      "api-token": { type: "string" },
      "index-name": { type: "string" },
      model: { type: "string" },
      "minimum-supervisor-count": { type: "string" },
      "max-delete-ratio": { type: "string" },
      "allow-large-delete": { type: "boolean" },
      debug: { type: "boolean" },
      "dry-run": { type: "boolean" },
    },
    allowPositionals: false,
  });

  const inputPath = values.input;
  const accountId = values["account-id"] ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = values["api-token"] ?? process.env.CLOUDFLARE_API_TOKEN;
  const indexName = values["index-name"] ?? process.env.SUPERVISOR_SEARCH_INDEX_NAME;
  const model = values.model ?? process.env.SUPERVISOR_SEARCH_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const minimumSupervisorCount = parseIntegerOption(values["minimum-supervisor-count"], "--minimum-supervisor-count");
  const maxDeleteRatio = parseRatioOption(values["max-delete-ratio"], "--max-delete-ratio");
  const allowLargeDelete = values["allow-large-delete"] ?? false;
  const debug = values.debug ?? false;
  const dryRun = values["dry-run"] ?? false;

  if (!inputPath) {
    throw new Error("Missing required --input <html-file> argument.");
  }

  if (!accountId) {
    throw new Error("Missing Cloudflare account id. Use --account-id or CLOUDFLARE_ACCOUNT_ID.");
  }

  if (!apiToken) {
    throw new Error("Missing Cloudflare API token. Use --api-token or CLOUDFLARE_API_TOKEN.");
  }

  if (!indexName) {
    throw new Error("Missing Vectorize index name. Use --index-name or SUPERVISOR_SEARCH_INDEX_NAME.");
  }

  const html = await readFile(inputPath, "utf8");
  const importedAt = new Date().toISOString();
  const supervisors = parseSupervisorSnapshot(html, importedAt);

  debugLog(debug, "Import configuration", {
    inputPath,
    dryRun,
    accountId,
    indexName,
    model,
    minimumSupervisorCount,
    maxDeleteRatio,
    allowLargeDelete,
  });
  debugLog(debug, "Parsed supervisors", {
    importedAt,
    supervisorCount: supervisors.length,
  });

  if (supervisors.length === 0) {
    throw new Error("No supervisors were parsed from the input HTML. Update the parser adapter before importing.");
  }

  const existingIds = await listExistingVectorIds({ accountId, apiToken, indexName, debug });
  validateSupervisorImport(supervisors, existingIds, [], {
    minimumSupervisorCount,
  });

  const embeddings = await createEmbeddings({
    accountId,
    apiToken,
    debug,
    model,
    texts: supervisors.map((supervisor) => supervisor.searchText),
  });

  const importPlan = planSupervisorImport(supervisors, embeddings, existingIds);
  debugLog(debug, "Import plan", {
    upsertCount: importPlan.vectors.length,
    deleteCount: importPlan.idsToDelete.length,
    sampleIdsToDelete: importPlan.idsToDelete.slice(0, 10),
  });
  validateSupervisorImport(supervisors, existingIds, importPlan.idsToDelete, {
    minimumSupervisorCount,
    maxDeleteRatio,
    allowLargeDelete,
  });
  const indexInfo = await getIndexInfo({ accountId, apiToken, indexName, debug });

  if (typeof indexInfo.dimensions === "number" && importPlan.vectors[0] && importPlan.vectors[0].values.length !== indexInfo.dimensions) {
    throw new Error(
      `Vector dimension mismatch: index expects ${indexInfo.dimensions}, but model ${model} returned ${importPlan.vectors[0].values.length}.`,
    );
  }

  if (!dryRun) {
    await upsertVectors({
      accountId,
      apiToken,
      debug,
      indexName,
      ndjson: importPlan.vectorNdjson,
    });

    if (importPlan.idsToDelete.length > 0) {
      await deleteVectors({
        accountId,
        apiToken,
        debug,
        indexName,
        ids: importPlan.idsToDelete,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        status: dryRun ? "Dry run" : "Import complete",
        model,
        importedAt,
        supervisorCount: importPlan.supervisors.length,
        upsertCount: importPlan.vectors.length,
        deleteCount: importPlan.idsToDelete.length,
        idsToDelete: importPlan.idsToDelete,
      },
      null,
      2,
    ),
  );
}

async function createEmbeddings(input: {
  accountId: string;
  apiToken: string;
  debug: boolean;
  model: string;
  texts: string[];
}): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let index = 0; index < input.texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = input.texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    debugLog(input.debug, "Embedding batch", {
      batchStart: index,
      batchSize: batch.length,
      model: input.model,
    });
    const response = await callCloudflareApi<{ data?: number[][] } | { result?: { data?: number[][] } }>({
      accountId: input.accountId,
      apiToken: input.apiToken,
      debug: input.debug,
      method: "POST",
      operation: "create embeddings",
      path: `/ai/run/${input.model}`,
      body: JSON.stringify({ text: batch }),
      headers: {
        "content-type": "application/json",
      },
    });

    const payload = extractEmbeddingResponse(response);
    const batchEmbeddings = payload.data ?? [];

    if (!Array.isArray(batchEmbeddings) || batchEmbeddings.length !== batch.length) {
      throw new Error(`Embedding request returned ${batchEmbeddings.length} vectors for ${batch.length} inputs.`);
    }

    embeddings.push(...batchEmbeddings.map((embedding) => embedding.map((value: number) => Number(value))));
  }

  return embeddings;
}

async function listExistingVectorIds(input: { accountId: string; apiToken: string; debug: boolean; indexName: string }): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null | undefined;

  do {
    const query = new URLSearchParams({ count: String(VECTORIZE_PAGE_SIZE) });
    if (cursor) {
      query.set("cursor", cursor);
    }

    const response = await callCloudflareApi<VectorListResponse>({
      accountId: input.accountId,
      apiToken: input.apiToken,
      debug: input.debug,
      method: "GET",
      operation: "list existing vector ids",
      path: `/vectorize/v2/indexes/${input.indexName}/list?${query.toString()}`,
    });

    ids.push(...(response.vectors ?? []));
    cursor = response.nextCursor;
  } while (cursor);

  debugLog(input.debug, "Existing index state", {
    existingIdCount: ids.length,
  });
  return ids;
}

async function getIndexInfo(input: { accountId: string; apiToken: string; debug: boolean; indexName: string }): Promise<IndexInfoResponse> {
  return await callCloudflareApi<IndexInfoResponse>({
    accountId: input.accountId,
    apiToken: input.apiToken,
    debug: input.debug,
    method: "GET",
    operation: "get index info",
    path: `/vectorize/v2/indexes/${input.indexName}/info`,
  });
}

async function upsertVectors(input: {
  accountId: string;
  apiToken: string;
  debug: boolean;
  indexName: string;
  ndjson: string;
}): Promise<void> {
  await callCloudflareApi<{ mutationId?: string }>({
    accountId: input.accountId,
    apiToken: input.apiToken,
    debug: input.debug,
    method: "POST",
    operation: "upsert vectors",
    path: `/vectorize/v2/indexes/${input.indexName}/upsert`,
    body: input.ndjson,
    headers: {
      "content-type": "application/x-ndjson",
    },
  });
}

async function deleteVectors(input: {
  accountId: string;
  apiToken: string;
  debug: boolean;
  indexName: string;
  ids: string[];
}): Promise<void> {
  await callCloudflareApi<{ mutationId?: string }>({
    accountId: input.accountId,
    apiToken: input.apiToken,
    debug: input.debug,
    method: "POST",
    operation: "delete vectors",
    path: `/vectorize/v2/indexes/${input.indexName}/delete_by_ids`,
    body: JSON.stringify({ ids: input.ids }),
    headers: {
      "content-type": "application/json",
    },
  });
}

async function callCloudflareApi<T>(input: {
  accountId: string;
  apiToken: string;
  debug: boolean;
  method: string;
  operation: string;
  path: string;
  body?: BodyInit;
  headers?: Record<string, string>;
}): Promise<T> {
  debugLog(input.debug, "Cloudflare request", {
    operation: input.operation,
    method: input.method,
    path: input.path,
  });
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${input.accountId}${input.path}`, {
    method: input.method,
    body: input.body,
    headers: {
      authorization: `Bearer ${input.apiToken}`,
      ...input.headers,
    },
  });

  const rawBody = await response.text();
  const payload = tryParseJson(rawBody) as CloudflareEnvelope<T> | null;

  if (!response.ok || !payload?.success) {
    const message =
      payload?.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") ||
      response.statusText ||
      "Unknown Cloudflare API failure";
    const responseBodyPreview = summarizeBody(rawBody);
    throw new Error(
      `Cloudflare API request failed during ${input.operation}: ${input.method} ${input.path} -> ` +
        `${response.status} ${response.statusText}. ${message}. Response body: ${responseBodyPreview}`,
    );
  }

  debugLog(input.debug, "Cloudflare response", {
    operation: input.operation,
    status: response.status,
  });
  return payload.result;
}

function extractEmbeddingResponse(payload: { data?: number[][] } | { result?: { data?: number[][] } }): { data?: number[][] } {
  if ("data" in payload) {
    return payload;
  }

  return "result" in payload ? (payload.result ?? { data: [] }) : { data: [] };
}

function parseIntegerOption(rawValue: string | undefined, flagName: string): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }

  return parsedValue;
}

function parseRatioOption(rawValue: string | undefined, flagName: string): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    throw new Error(`${flagName} must be a number between 0 and 1.`);
  }

  return parsedValue;
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});

function debugLog(enabled: boolean, label: string, details: Record<string, unknown>): void {
  if (!enabled) {
    return;
  }

  console.error(`[import:supervisors:debug] ${label}: ${JSON.stringify(details, null, 2)}`);
}

function tryParseJson(rawBody: string): unknown {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function summarizeBody(rawBody: string): string {
  const compactBody = rawBody.replace(/\s+/g, " ").trim();
  if (!compactBody) {
    return "<empty>";
  }

  return compactBody.length > CLOUDLFARE_ERROR_BODY_LIMIT ? `${compactBody.slice(0, CLOUDLFARE_ERROR_BODY_LIMIT)}...` : compactBody;
}
