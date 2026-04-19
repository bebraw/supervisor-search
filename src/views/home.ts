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
    <script>
      const queryInput = document.getElementById("supervisor-query");
      const statusElement = document.getElementById("search-status");
      const resultsElement = document.getElementById("search-results");
      const minimumQueryLength = 2;
      let debounceHandle = null;
      let activeController = null;
      let requestCounter = 0;

      function setStatus(message) {
        statusElement.textContent = message;
      }

      function clearResults() {
        while (resultsElement.firstChild) {
          resultsElement.removeChild(resultsElement.firstChild);
        }
      }

      function renderResults(results) {
        clearResults();

        for (const result of results) {
          const item = document.createElement("li");
          item.className = "py-5 sm:py-6";

          const title = document.createElement("h3");
          title.className = "text-xl font-semibold tracking-[-0.03em] text-app-text sm:text-2xl";
          title.textContent = result.name;

          const topic = document.createElement("p");
          topic.className = "mt-2 max-w-3xl text-base leading-7 text-app-text-soft";
          topic.textContent = result.topicArea;

          const meta = document.createElement("p");
          meta.className = "mt-3 text-sm text-app-text-soft";
          meta.textContent = result.activeThesisCount + (result.activeThesisCount === 1 ? " active thesis" : " active theses");

          item.append(title, topic, meta);
          resultsElement.appendChild(item);
        }
      }

      async function runSearch(rawQuery) {
        const query = rawQuery.trim();

        if (!query) {
          if (activeController) {
            activeController.abort();
            activeController = null;
          }
          clearResults();
          setStatus("");
          return;
        }

        if (query.length < minimumQueryLength) {
          if (activeController) {
            activeController.abort();
            activeController = null;
          }
          clearResults();
          setStatus("Type at least " + minimumQueryLength + " characters.");
          return;
        }

        const currentRequest = ++requestCounter;
        if (activeController) {
          activeController.abort();
        }
        activeController = new AbortController();
        const currentController = activeController;
        setStatus("Searching...");

        try {
          const response = await fetch("/api/search?q=" + encodeURIComponent(query), {
            headers: {
              accept: "application/json",
            },
            signal: currentController.signal,
          });
          const payload = await response.json();

          if (currentRequest !== requestCounter || currentController !== activeController) {
            return;
          }

          if (!response.ok) {
            clearResults();
            setStatus(payload.error || "Search failed.");
            return;
          }

          if (!payload.results.length) {
            clearResults();
            setStatus("No supervisors matched that query.");
            return;
          }

          renderResults(payload.results);
          setStatus(payload.results.length + (payload.results.length === 1 ? " result" : " results"));
        } catch (error) {
          if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
            return;
          }

          clearResults();
          setStatus("Search failed. Try again.");
        } finally {
          if (currentController === activeController) {
            activeController = null;
          }
        }
      }

      queryInput.addEventListener("input", (event) => {
        const nextValue = event.currentTarget.value;
        window.clearTimeout(debounceHandle);
        debounceHandle = window.setTimeout(() => runSearch(nextValue), 180);
      });
    </script>
  </body>
</html>`;
}
