export const appRoutes = [
  { path: "/", purpose: "Basic-auth protected supervisor search" },
  { path: "/admin", purpose: "Basic-auth protected runtime ranking admin surface" },
  { path: "/api/search", purpose: "Realtime JSON search for supervisor matches" },
  { path: "/api/admin/search-weights", purpose: "Authenticated runtime ranking configuration API" },
  { path: "/api/health", purpose: "JSON health endpoint for tooling and smoke tests" },
] as const;
