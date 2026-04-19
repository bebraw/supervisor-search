import type { SupervisorSearchEnv } from "./types.ts";
import { textResponse } from "../views/shared";

const basicAuthRealm = 'Basic realm="Supervisor Search", charset="UTF-8"';

export function ensureAuthorizedRequest(request: Request, env: SupervisorSearchEnv): Response | null {
  const expectedUsername = env.SUPERVISOR_SEARCH_BASIC_AUTH_USERNAME;
  const expectedPassword = env.SUPERVISOR_SEARCH_BASIC_AUTH_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return textResponse("Supervisor search credentials are not configured.", {
      status: 503,
    });
  }

  const credentials = readBasicAuthHeader(request.headers.get("authorization"));
  if (!credentials) {
    return createUnauthorizedResponse();
  }

  const isAuthorized = safeEqual(credentials.username, expectedUsername) && safeEqual(credentials.password, expectedPassword);
  return isAuthorized ? null : createUnauthorizedResponse();
}

function readBasicAuthHeader(headerValue: string | null): { username: string; password: string } | null {
  if (!headerValue?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(headerValue.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function createUnauthorizedResponse(): Response {
  return textResponse("Authentication required.", {
    status: 401,
    headers: {
      "www-authenticate": basicAuthRealm,
    },
  });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
