export function renderHomeScript(): string {
  return `const queryInput = document.getElementById("supervisor-query");
const statusElement = document.getElementById("search-status");
const resultsElement = document.getElementById("search-results");
const searchParamName = "q";
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

function syncUrlQuery(rawQuery) {
  const url = new URL(window.location.href);
  const query = rawQuery.trim();

  if (query) {
    url.searchParams.set(searchParamName, query);
  } else {
    url.searchParams.delete(searchParamName);
  }

  window.history.replaceState(window.history.state, "", url);
}

function renderResults(results) {
  clearResults();

  for (const result of results) {
    const item = document.createElement("li");
    item.className = "border-t border-app-line py-6 first:border-t-0 sm:py-7";

    const title = document.createElement("h3");
    title.className = "text-[1.6rem] leading-tight font-semibold tracking-[-0.045em] text-app-text sm:text-[2rem]";
    title.textContent = result.name;

    const topic = document.createElement("p");
    topic.className = "mt-3 max-w-3xl text-base leading-7 text-app-text-soft sm:text-[1.05rem]";
    topic.textContent = result.topicArea;

    const meta = document.createElement("p");
    meta.className = "mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-app-accent";
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
  syncUrlQuery(nextValue);
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(() => runSearch(nextValue), 180);
});

const initialQuery = new URL(window.location.href).searchParams.get(searchParamName) || "";
if (initialQuery) {
  queryInput.value = initialQuery;
  runSearch(initialQuery);
}
`;
}
