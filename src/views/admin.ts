import { escapeHtml } from "./shared";

const pageTitle = "Search Ranking Admin";

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="stylesheet" href="/styles.css">
    <script src="/admin.js" defer></script>
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="min-h-screen px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
      <div class="mx-auto flex max-w-4xl flex-col gap-8 sm:gap-10">
        <header class="max-w-3xl pb-2 sm:pb-4">
          <p class="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-app-accent">Admin</p>
          <h1 class="mt-3 text-[clamp(2.4rem,7vw,4.8rem)] leading-[0.94] font-semibold tracking-[-0.07em]">${escapeHtml(pageTitle)}</h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">
            Adjust the live reranking mix without redeploying the Worker. Values must stay between 0 and 1 and add up to 1.0.
          </p>
        </header>
        <section class="max-w-3xl rounded-[2rem] border border-app-line bg-app-surface/88 p-5 shadow-[var(--shadow-panel)] sm:p-7">
          <div class="flex flex-col gap-3 border-b border-app-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-app-accent">Current source</p>
              <p id="weights-source" class="mt-2 text-base leading-7 text-app-text-soft">Loading...</p>
            </div>
            <p id="weights-total" class="text-sm leading-6 text-app-text-soft">Total: --</p>
          </div>
          <form id="search-weights-form" class="mt-6 grid gap-5">
            <label class="grid gap-2" for="vector-similarity-weight">
              <span class="text-sm font-semibold uppercase tracking-[0.2em] text-app-accent">Vector similarity</span>
              <input id="vector-similarity-weight" name="vectorSimilarity" type="number" min="0" max="1" step="0.01" class="w-full rounded-[1.2rem] bg-app-canvas px-4 py-3 text-lg text-app-text outline-none ring-1 ring-app-line transition focus:ring-2 focus:ring-app-accent/35">
            </label>
            <label class="grid gap-2" for="topic-overlap-weight">
              <span class="text-sm font-semibold uppercase tracking-[0.2em] text-app-accent">Topic overlap</span>
              <input id="topic-overlap-weight" name="topicOverlap" type="number" min="0" max="1" step="0.01" class="w-full rounded-[1.2rem] bg-app-canvas px-4 py-3 text-lg text-app-text outline-none ring-1 ring-app-line transition focus:ring-2 focus:ring-app-accent/35">
            </label>
            <label class="grid gap-2" for="availability-weight">
              <span class="text-sm font-semibold uppercase tracking-[0.2em] text-app-accent">Availability</span>
              <input id="availability-weight" name="availability" type="number" min="0" max="1" step="0.01" class="w-full rounded-[1.2rem] bg-app-canvas px-4 py-3 text-lg text-app-text outline-none ring-1 ring-app-line transition focus:ring-2 focus:ring-app-accent/35">
            </label>
            <div class="flex flex-col gap-3 pt-2 sm:flex-row">
              <button id="save-weights-button" type="submit" class="rounded-full bg-app-text px-5 py-3 text-sm font-semibold tracking-[0.18em] text-app-canvas uppercase transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Save weights</button>
              <button id="reset-weights-button" type="button" class="rounded-full border border-app-line px-5 py-3 text-sm font-semibold tracking-[0.18em] text-app-text uppercase transition hover:bg-app-canvas disabled:cursor-not-allowed disabled:opacity-50">Reset to defaults</button>
            </div>
          </form>
          <div id="admin-status" class="mt-5 text-sm leading-6 text-app-text-soft" aria-live="polite"></div>
        </section>
      </div>
    </main>
  </body>
</html>`;
}
