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
    <main class="min-h-screen px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
      <div class="mx-auto flex max-w-5xl flex-col gap-8">
        <header class="pb-6 sm:pb-8">
          <div>
            <p class="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-app-accent">Supervisor Search</p>
            <h1 class="mt-3 text-[clamp(2rem,6vw,4.5rem)] leading-none font-semibold tracking-[-0.06em] sm:whitespace-nowrap">${escapeHtml(appTitle)}</h1>
          </div>
        </header>
        <section class="max-w-3xl">
          <label class="block" for="supervisor-query">
            <span class="sr-only">Search supervisors</span>
            <input id="supervisor-query" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="Type a topic, method, or research area" class="w-full rounded-2xl bg-app-accent/6 px-5 py-4 text-xl text-app-text outline-none ring-1 ring-app-line transition placeholder:text-app-text-soft/72 focus:bg-app-accent/8 focus:ring-2 focus:ring-app-accent/35">
          </label>
          <div id="search-status" class="mt-3 text-sm leading-6 text-app-text-soft"></div>
          <ol id="search-results" class="mt-8 grid gap-6" aria-live="polite"></ol>
        </section>
      </div>
    </main>
  </body>
</html>`;
}
