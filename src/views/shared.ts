const securityHeaders = {
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
} as const;

const documentContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
].join("; ");

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": documentContentSecurityPolicy,
      ...securityHeaders,
    },
  });
}

export function cssResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders,
    },
  });
}

export function javascriptResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders,
    },
  });
}

export function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  const response = Response.json(payload, init);
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", securityHeaders["referrer-policy"]);
  response.headers.set("x-content-type-options", securityHeaders["x-content-type-options"]);
  response.headers.set("x-frame-options", securityHeaders["x-frame-options"]);
  response.headers.set("permissions-policy", securityHeaders["permissions-policy"]);
  return response;
}

export function textResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders,
      ...(init?.headers ?? {}),
    },
  });
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
