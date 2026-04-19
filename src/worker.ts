import { createHealthResponse } from "./api/health";
import { createSearchResponse } from "./api/search";
import { appRoutes } from "./app-routes";
import { ensureAuthorizedRequest } from "./supervisors/auth";
import type { SupervisorSearchEnv } from "./supervisors/types";
import { renderHomePage } from "./views/home";
import { renderHomeScript } from "./views/home-script";
import { renderNotFoundPage } from "./views/not-found";
import { cssResponse, htmlResponse, javascriptResponse } from "./views/shared";

export default {
  async fetch(request: Request, env: SupervisorSearchEnv): Promise<Response> {
    return await handleRequest(request, env);
  },
};

export async function handleRequest(request: Request, env: SupervisorSearchEnv): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/styles.css") {
    return cssResponse(await loadStylesheet());
  }

  if (url.pathname === "/app.js") {
    return javascriptResponse(renderHomeScript());
  }

  if (url.pathname === "/api/health") {
    return createHealthResponse(appRoutes.map((route) => route.path));
  }

  const authorizationFailure = ensureAuthorizedRequest(request, env);
  if (authorizationFailure) {
    return authorizationFailure;
  }

  if (url.pathname === "/") {
    return htmlResponse(renderHomePage());
  }

  if (url.pathname === "/api/search") {
    return await createSearchResponse(request, env);
  }

  return htmlResponse(renderNotFoundPage(url.pathname), 404);
}

async function loadStylesheet(): Promise<string> {
  if (typeof process !== "undefined" && process.release?.name === "node") {
    const { readFile } = await import("node:fs/promises");
    return await readFile(new URL("../.generated/styles.css", import.meta.url), "utf8");
  }

  const styles = await import("../.generated/styles.css");
  return styles.default;
}
