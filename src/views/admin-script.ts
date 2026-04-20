export function renderAdminScript(): string {
  return `const form = document.getElementById("search-weights-form");
const statusElement = document.getElementById("admin-status");
const sourceElement = document.getElementById("weights-source");
const totalElement = document.getElementById("weights-total");
const saveButton = document.getElementById("save-weights-button");
const resetButton = document.getElementById("reset-weights-button");
const fields = {
  vectorSimilarity: document.getElementById("vector-similarity-weight"),
  topicOverlap: document.getElementById("topic-overlap-weight"),
  availability: document.getElementById("availability-weight"),
};

function setStatus(message) {
  statusElement.textContent = message;
}

function collectWeights() {
  return {
    vectorSimilarity: Number.parseFloat(fields.vectorSimilarity.value),
    topicOverlap: Number.parseFloat(fields.topicOverlap.value),
    availability: Number.parseFloat(fields.availability.value),
  };
}

function renderTotal() {
  const weights = collectWeights();
  const total = Object.values(weights).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  totalElement.textContent = "Total: " + total.toFixed(2);
}

function formatSource(state) {
  if (!state.canPersist) {
    return "Defaults only. Bind SUPERVISOR_SEARCH_CONFIG to enable live edits.";
  }

  if (state.source === "kv" && state.updatedAt) {
    return "Runtime override saved on " + new Date(state.updatedAt).toLocaleString() + ".";
  }

  return "Using code defaults.";
}

function applyState(state) {
  fields.vectorSimilarity.value = String(state.weights.vectorSimilarity);
  fields.topicOverlap.value = String(state.weights.topicOverlap);
  fields.availability.value = String(state.weights.availability);
  sourceElement.textContent = formatSource(state);
  saveButton.disabled = !state.canPersist;
  resetButton.disabled = !state.canPersist;
  renderTotal();
}

async function readState() {
  const response = await fetch("/api/admin/search-weights", {
    headers: {
      accept: "application/json",
    },
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Failed to load runtime weights.");
  }

  return payload;
}

async function writeState(method, body) {
  const response = await fetch("/api/admin/search-weights", {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body,
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Failed to update runtime weights.");
  }

  return payload;
}

form.addEventListener("input", () => {
  renderTotal();
  setStatus("");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving...");

  try {
    const payload = await writeState("PUT", JSON.stringify({ weights: collectWeights() }));
    applyState(payload);
    setStatus("Weights updated.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to update runtime weights.");
  }
});

resetButton.addEventListener("click", async () => {
  setStatus("Resetting...");

  try {
    const payload = await writeState("DELETE", JSON.stringify({}));
    applyState(payload);
    setStatus("Runtime override cleared.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to reset runtime weights.");
  }
});

setStatus("Loading...");
readState()
  .then((state) => {
    applyState(state);
    setStatus(state.canPersist ? "" : "Runtime edits are disabled until the KV binding is configured.");
  })
  .catch((error) => {
    setStatus(error instanceof Error ? error.message : "Failed to load runtime weights.");
  });
`;
}
