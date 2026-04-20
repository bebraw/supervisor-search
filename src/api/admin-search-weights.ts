import {
  MISSING_SEARCH_CONFIG_MESSAGE,
  SearchWeightsValidationError,
  getSupervisorSearchWeightsState,
  resetSupervisorSearchWeights,
  updateSupervisorSearchWeights,
} from "../supervisors/config.ts";
import type { SupervisorSearchEnv } from "../supervisors/types.ts";
import { jsonResponse } from "../views/shared";

const invalidPayloadMessage = "Search weight updates must be sent as JSON.";

export async function createAdminSearchWeightsResponse(env: SupervisorSearchEnv): Promise<Response> {
  return jsonResponse({
    ok: true,
    ...(await getSupervisorSearchWeightsState(env)),
  });
}

export async function updateAdminSearchWeightsResponse(request: Request, env: SupervisorSearchEnv): Promise<Response> {
  const sameOriginFailure = ensureSameOriginAdminMutation(request);
  if (sameOriginFailure) {
    return sameOriginFailure;
  }

  const contentTypeFailure = ensureJsonContentType(request);
  if (contentTypeFailure) {
    return contentTypeFailure;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: invalidPayloadMessage,
      },
      { status: 400 },
    );
  }

  try {
    return jsonResponse({
      ok: true,
      ...(await updateSupervisorSearchWeights(env, extractWeightsPayload(payload))),
    });
  } catch (error) {
    return createAdminMutationErrorResponse(error);
  }
}

export async function resetAdminSearchWeightsResponse(request: Request, env: SupervisorSearchEnv): Promise<Response> {
  const sameOriginFailure = ensureSameOriginAdminMutation(request);
  if (sameOriginFailure) {
    return sameOriginFailure;
  }

  try {
    return jsonResponse({
      ok: true,
      ...(await resetSupervisorSearchWeights(env)),
    });
  } catch (error) {
    return createAdminMutationErrorResponse(error);
  }
}

function extractWeightsPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || !("weights" in payload)) {
    throw new SearchWeightsValidationError("Request body must include a weights object.");
  }

  return (payload as { weights: unknown }).weights;
}

function createAdminMutationErrorResponse(error: unknown): Response {
  if (error instanceof SearchWeightsValidationError) {
    return jsonResponse(
      {
        ok: false,
        error: error.message,
      },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === MISSING_SEARCH_CONFIG_MESSAGE) {
    return jsonResponse(
      {
        ok: false,
        error: error.message,
      },
      { status: 503 },
    );
  }

  console.error("Failed to update runtime search weights.", error);
  return jsonResponse(
    {
      ok: false,
      error: "Runtime ranking configuration is currently unavailable.",
    },
    { status: 503 },
  );
}

function ensureJsonContentType(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return jsonResponse(
      {
        ok: false,
        error: invalidPayloadMessage,
      },
      { status: 415 },
    );
  }

  return null;
}

function ensureSameOriginAdminMutation(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== requestUrl.origin) {
    return jsonResponse(
      {
        ok: false,
        error: "Cross-origin admin requests are not allowed.",
      },
      { status: 403 },
    );
  }

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return jsonResponse(
      {
        ok: false,
        error: "Cross-site admin requests are not allowed.",
      },
      { status: 403 },
    );
  }

  return null;
}
