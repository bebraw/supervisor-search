import { escapeHtml } from "./shared";

const appTitle = "Find an MSc Supervisor";

export function renderHomePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(appTitle)}</title>
    <link rel="stylesheet" href="/styles.css">
    <script src="/app.js" defer></script>
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="min-h-screen px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
      <div class="mx-auto flex max-w-4xl flex-col gap-8 sm:gap-10">
        <header class="max-w-3xl pb-2 sm:pb-4">
          <div>
            <p class="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-app-accent">Supervisor Search</p>
            <h1 class="mt-3 max-w-4xl text-[clamp(2.6rem,8vw,5.6rem)] leading-[0.92] font-semibold tracking-[-0.07em]">${escapeHtml(appTitle)}</h1>
            <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">
              Search current thesis topics and compare active supervision areas without leaving the page.
            </p>
          </div>
        </header>
        <section class="max-w-3xl">
          <div class="sticky top-0 z-10 -mx-3 rounded-[1.9rem] border border-app-line bg-app-canvas/92 px-3 py-3 shadow-[var(--shadow-panel)] supports-[backdrop-filter]:bg-app-canvas/72 backdrop-blur-xl">
            <label class="block" for="supervisor-query">
              <span class="sr-only">Search supervisors</span>
              <input id="supervisor-query" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Type a topic, method, or research area" class="w-full rounded-[1.55rem] bg-app-surface px-5 py-4 text-xl text-app-text outline-none ring-1 ring-app-line transition placeholder:text-app-text-soft/72 focus:bg-app-canvas focus:ring-2 focus:ring-app-accent/35">
            </label>
            <div id="search-status" class="mt-3 text-sm leading-6 text-app-text-soft"></div>
          </div>
          <ol id="search-results" class="mt-8 grid pb-12" aria-live="polite"></ol>
        </section>
      </div>
    </main>
  </body>
</html>`;
}
