const state = {
  tree: null,
  artifacts: [],
  selectedPath: null
};

const treeEl = document.querySelector("#artifact-tree");
const filterEl = document.querySelector("#filter");
const contentEl = document.querySelector("#content");
const titleEl = document.querySelector("#artifact-title");
const pathEl = document.querySelector("#artifact-path");
const kindEl = document.querySelector("#artifact-kind");
const summaryEl = document.querySelector("#summary");

filterEl.addEventListener("input", () => renderTree());

loadArtifacts().catch((error) => {
  contentEl.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
});

async function loadArtifacts() {
  const response = await fetch("/api/artifacts");
  state.tree = await response.json();
  state.artifacts = flattenArtifacts(state.tree);
  renderTree();
}

function renderTree() {
  const filter = filterEl.value.trim().toLowerCase();
  treeEl.innerHTML = "";

  addSection("Global Reports", state.tree.globalArtifacts, filter);
  for (const experiment of state.tree.experiments) {
    addSection(experiment.experimentId, experiment.artifacts, filter);
    for (const mutation of experiment.mutations) {
      addSection(`${experiment.experimentId} / ${mutation.mutationId}`, mutation.artifacts, filter);
    }
  }
}

function addSection(title, artifacts, filter) {
  const visible = artifacts.filter((artifact) => !filter || artifact.label.toLowerCase().includes(filter) || artifact.path.toLowerCase().includes(filter));
  if (visible.length === 0) {
    return;
  }

  const section = document.createElement("section");
  section.className = "artifact-section";
  section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
  for (const artifact of visible) {
    const button = document.createElement("button");
    button.className = `artifact-button${artifact.path === state.selectedPath ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<span>${escapeHtml(artifact.label)}</span><br><span class="artifact-meta">${escapeHtml(artifact.kind)}</span>`;
    button.addEventListener("click", () => selectArtifact(artifact));
    section.append(button);
  }
  treeEl.append(section);
}

async function selectArtifact(artifact) {
  state.selectedPath = artifact.path;
  renderTree();

  const response = await fetch(`/api/file?path=${encodeURIComponent(artifact.path)}`);
  if (!response.ok) {
    contentEl.innerHTML = `<p class="empty">Could not load ${escapeHtml(artifact.path)}</p>`;
    return;
  }

  const file = await response.json();
  titleEl.textContent = artifact.label;
  pathEl.textContent = artifact.path;
  kindEl.textContent = artifact.kind;
  renderContent(file);
  renderSummary(artifact, file);
}

function renderContent(file) {
  if (file.kind === "json") {
    try {
      contentEl.innerHTML = `<pre><code>${escapeHtml(JSON.stringify(JSON.parse(file.content), null, 2))}</code></pre>`;
    } catch {
      contentEl.innerHTML = `<pre><code>${escapeHtml(file.content)}</code></pre>`;
    }
    return;
  }

  if (file.kind === "markdown") {
    contentEl.innerHTML = renderMarkdown(file.content);
    return;
  }

  contentEl.innerHTML = `<pre><code>${escapeHtml(file.content)}</code></pre>`;
}

function renderSummary(artifact, file) {
  const rows = [
    ["Group", artifact.group],
    ["Experiment", artifact.experimentId || "global"],
    ["Mutation", artifact.mutationId || "none"],
    ["Kind", artifact.kind]
  ];

  if (file.kind === "json") {
    try {
      rows.push(["Top-level keys", Object.keys(JSON.parse(file.content)).join(", ") || "none"]);
    } catch {
      rows.push(["Top-level keys", "invalid json"]);
    }
  }

  if (file.kind === "markdown") {
    rows.push(["First heading", firstHeading(file.content) || "none"]);
  }

  summaryEl.innerHTML = rows
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
}

function flattenArtifacts(tree) {
  const artifacts = [...tree.globalArtifacts];
  for (const experiment of tree.experiments) {
    artifacts.push(...experiment.artifacts);
    for (const mutation of experiment.mutations) {
      artifacts.push(...mutation.artifacts);
    }
  }
  return artifacts;
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let inCode = false;
  const html = [];
  for (const line of lines) {
    if (line.startsWith("```")) {
      html.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(escapeHtml(line));
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
    } else if (line.startsWith("- ")) {
      html.push(`<p>• ${escapeHtml(line.slice(2))}</p>`);
    } else if (line.trim() === "") {
      html.push("");
    } else {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  return html.join("\n");
}

function firstHeading(markdown) {
  const match = markdown.match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1] : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
