export function renderHomeScript(): string {
  return `const queryInput = document.getElementById("supervisor-query");
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
`;
}
