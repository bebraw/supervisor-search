import { jsonResponse } from "../views/shared";

export function createHealthResponse(routes: string[]): Response {
  return jsonResponse({
    ok: true,
    name: "supervisor-search-worker",
    routes,
  });
}
