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

  const cards = buildObservatoryCards(artifact.path, file.content, file.kind);
  summaryEl.innerHTML = `
    <section class="summary-card basic-summary">
      <h3>Basic Summary</h3>
      <dl>${rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>
    </section>
    ${cards.map(renderCard).join("")}
  `;
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

function buildObservatoryCards(path, content, kind) {
  if (kind === "markdown" && path.endsWith("report.md")) {
    return buildReportMarkdownCard(content);
  }
  if (kind !== "json") {
    return [];
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }

  if (path.endsWith("stats.json")) return [card("Solver Stats", [
    row("bestScore", data.bestScore),
    row("averageScore", data.averageScore),
    row("bestFinalState", data.bestFinalState),
    row("averageFinalLength", data.averageFinalLength),
    row("distinctFinalStates", data.distinctFinalStates),
    row("runCount", data.runCount),
    row("top rule usage", topRuleUsage(data.ruleUsage))
  ])];

  if (path.endsWith("mutation_plan.json")) {
    const changeTypes = Array.isArray(data.mutations) ? [...new Set(data.mutations.map((mutation) => mutation?.changeType).filter(Boolean))].join(", ") : undefined;
    return [card("Mutation Plan", [
      row("Pattern", data.sourcePattern?.name),
      row("Hypothesis", data.hypothesis),
      row("Plan status", data.planStatus, badgeFor(data.planStatus)),
      row("Mutation count", Array.isArray(data.mutations) ? data.mutations.length : undefined),
      row("Change types", changeTypes)
    ])];
  }

  if (path.endsWith("survival_report.json")) {
    const counts = countBy(Array.isArray(data.results) ? data.results.map((result) => result?.status) : [], ["survived", "weakened", "broken", "inconclusive"]);
    return [card("Pattern Survival", [
      row("Pattern", data.sourcePatternName),
      row("Overall status", data.overallStatus, badgeFor(data.overallStatus)),
      row("Hypothesis", data.hypothesis),
      row("Result count", Array.isArray(data.results) ? data.results.length : undefined),
      row("survived", counts.survived, badgeFor("survived")),
      row("weakened", counts.weakened, badgeFor("weakened")),
      row("broken", counts.broken, badgeFor("broken")),
      row("inconclusive", counts.inconclusive, badgeFor("inconclusive"))
    ])];
  }

  if (path.endsWith("mutation_result.json")) return [card("Mutation Result", [
    row("mutationId", data.mutationId),
    row("title", data.title),
    row("changeType", data.changeType),
    row("status", data.status, badgeFor(data.status)),
    row("bestScoreDelta", data.comparison?.bestScoreDelta),
    row("averageScoreDelta", data.comparison?.averageScoreDelta),
    row("distinctFinalStatesDelta", data.comparison?.distinctFinalStatesDelta)
  ])];

  if (path.endsWith("pattern_survival_index.json")) {
    const entries = Array.isArray(data.entries) ? [...data.entries].sort((left, right) => Number(right?.survivalScore ?? 0) - Number(left?.survivalScore ?? 0)).slice(0, 3) : [];
    return [card("Survival Index", [
      row("experimentCount", data.experimentCount),
      row("mutationResultCount", data.mutationResultCount),
      row("survived", data.statusCounts?.survived, badgeFor("survived")),
      row("weakened", data.statusCounts?.weakened, badgeFor("weakened")),
      row("broken", data.statusCounts?.broken, badgeFor("broken")),
      row("inconclusive", data.statusCounts?.inconclusive, badgeFor("inconclusive")),
      row("entry count", Array.isArray(data.entries) ? data.entries.length : undefined),
      row("Top entries", entries.map((entry) => `${entry.patternName ?? "unknown"} (${formatScore(entry.survivalScore)} ${entry.survivalClass ?? ""})`).join("\n"))
    ])];
  }

  if (path.endsWith("evolution_parent_candidates.json")) {
    const candidates = Array.isArray(data.candidates) ? data.candidates.slice(0, 3) : [];
    return [card("Evolution Candidates", [
      row("candidateCount", data.candidateCount),
      row("promote_to_parent", data.decisionCounts?.promote_to_parent, badgeFor("promote_to_parent")),
      row("watchlist", data.decisionCounts?.watchlist),
      row("rename_or_split", data.decisionCounts?.rename_or_split, badgeFor("rename_or_split")),
      row("needs_more_tests", data.decisionCounts?.needs_more_tests),
      row("Top candidates", candidates.map((candidate) => `${candidate.patternName ?? "unknown"} (${candidate.decision ?? "unknown"}, ${formatScore(candidate.survivalScore)})`).join("\n"))
    ])];
  }

  if (path.endsWith("naming_debt_report.json")) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const debtReasons = countBy(entries.flatMap((entry) => Array.isArray(entry.debtReasons) ? entry.debtReasons : []));
    const nextActions = countBy(entries.map((entry) => entry.nextAction).filter(Boolean));
    const names = entries.flatMap((entry) => Array.isArray(entry.narrowerNameCandidates) ? entry.narrowerNameCandidates : []).slice(0, 3);
    return [card("Naming Debt", [
      row("entryCount", data.entryCount),
      ...Object.entries(debtReasons).map(([label, value]) => row(label, value)),
      ...Object.entries(nextActions).map(([label, value]) => row(label, value)),
      row("Narrower names", names.join("\n"))
    ])];
  }

  if (path.endsWith("research_signal_index.json")) {
    const topics = topRecordEntries(data.topicCounts, 3).map(([label, value]) => `${label}: ${value}`).join("\n");
    const connections = topRecordEntries(data.apgConnectionCounts, 3).map(([label, value]) => `${label}: ${value}`).join("\n");
    const recommendations = Array.isArray(data.recommendations)
      ? data.recommendations.slice(0, 3).map((item) => `${item.title ?? "unknown"} (${item.nextAction ?? "unknown"})`).join("\n")
      : undefined;
    return [card("Research Signals", [
      row("signalCount", data.signalCount),
      row("Top topics", topics),
      row("APG connections", connections),
      row("Recommendations", recommendations)
    ])];
  }

  return [];
}

function buildReportMarkdownCard(markdown) {
  const isMutationReport = /\/mutations\/MUT-[^/]+\/report\.md$/.test(state.selectedPath || "");
  return [card(isMutationReport ? "Mutation Snapshot" : "Experiment Snapshot", [
    row("Survival Status", sectionValue(markdown, "Survival Status"), badgeFor(sectionValue(markdown, "Survival Status"))),
    row("Best score", markdownValue(markdown, "Best score")),
    row("Average score", markdownValue(markdown, "Average score")),
    row("Best final state", markdownValue(markdown, "Best final state")),
    row("Best solver", markdownValue(markdown, "Best solver")),
    row("Distinct final states", markdownValue(markdown, "Distinct final states")),
    row("madowaku Name Candidate", markdownValue(markdown, "madowaku Name Candidate")),
    row("Cautions", hasSection(markdown, "Cautions") ? "present" : undefined)
  ])].filter((item) => item.rows.length > 0);
}

function renderCard(cardData) {
  if (!cardData.rows.length) return "";
  return `<section class="summary-card observatory-card">
    <h3>${escapeHtml(cardData.title)}</h3>
    <dl>${cardData.rows.map((item) => `<dt>${escapeHtml(item.label)}</dt><dd>${renderValue(item)}</dd>`).join("")}</dl>
  </section>`;
}

function renderValue(item) {
  const value = escapeHtml(item.value).replaceAll("\n", "<br>");
  return item.badge ? `<span class="status-badge status-${escapeClass(item.badge)}">${value}</span>` : value;
}

function card(title, rows) {
  return { title, rows: rows.filter((item) => item.value !== "unknown" && item.value !== "") };
}

function row(label, value, badge) {
  return { label, value: stringifyValue(value), badge };
}

function stringifyValue(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "unknown";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function badgeFor(value) {
  const text = stringifyValue(value);
  return new Set(["survived", "weakened", "broken", "inconclusive", "robust_candidate", "fragile_candidate", "promote_to_parent", "rename_or_split"]).has(text) ? text : undefined;
}

function countBy(values, knownValues) {
  const counts = {};
  for (const known of knownValues || []) counts[known] = 0;
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function markdownValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^-\\s*${escaped}\\s*:\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "im"),
    new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`, "i")
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function sectionValue(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*\\n+([^#\\n][^\\n]*)`, "im"));
  return match?.[1]?.trim();
}

function hasSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "im").test(markdown);
}

function topRuleUsage(ruleUsage) {
  if (!ruleUsage || typeof ruleUsage !== "object") return undefined;
  const [ruleId, count] = Object.entries(ruleUsage).sort((left, right) => Number(right[1]) - Number(left[1]))[0] || [];
  return ruleId ? `${ruleId}: ${count}` : undefined;
}

function topRecordEntries(record, limit) {
  if (!record || typeof record !== "object") return [];
  return Object.entries(record)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, value]) => [key, Number(value)]);
}

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(2) : "unknown";
}

function escapeClass(value) {
  return String(value).replace(/[^a-z0-9_-]/gi, "-");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
