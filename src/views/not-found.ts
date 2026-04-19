import { escapeHtml } from "./shared";

export function renderNotFoundPage(pathname: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Not Found</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="flex min-h-screen items-center px-6 py-10 sm:px-10">
      <div class="mx-auto w-full max-w-2xl rounded-[2rem] border border-app-line bg-app-canvas/92 p-8 shadow-[var(--shadow-panel)] supports-[backdrop-filter]:bg-app-canvas/72 backdrop-blur-xl sm:p-10">
        <p class="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-app-accent">Route Missing</p>
        <h1 class="mt-4 text-[clamp(2.4rem,8vw,4.5rem)] leading-[0.94] font-semibold tracking-[-0.06em]">Not Found</h1>
        <p class="mt-4 max-w-xl text-base leading-7 text-app-text-soft sm:text-lg">
          No route is defined for <code class="rounded-md bg-app-surface px-2 py-1 text-sm text-app-text">${escapeHtml(pathname)}</code>.
        </p>
      </div>
    </main>
  </body>
</html>`;
}
