import { MINIMUM_QUERY_LENGTH, type SupervisorSearchEnv } from "../supervisors/types";
import { searchSupervisors } from "../supervisors/service";
import { jsonResponse } from "../views/shared";

const genericSearchErrorMessage = "Supervisor search is currently unavailable.";

export async function createSearchResponse(request: Request, env: SupervisorSearchEnv): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < MINIMUM_QUERY_LENGTH) {
    return jsonResponse(
      {
        ok: false,
        error: `Search queries must be at least ${MINIMUM_QUERY_LENGTH} characters long.`,
        minimumQueryLength: MINIMUM_QUERY_LENGTH,
      },
      { status: 400 },
    );
  }

  try {
    const response = await searchSupervisors(query, env);
    return jsonResponse(response);
  } catch (error) {
    console.error("Supervisor search failed.", error);

    return jsonResponse(
      {
        ok: false,
        error: genericSearchErrorMessage,
      },
      { status: 503 },
    );
  }
}
