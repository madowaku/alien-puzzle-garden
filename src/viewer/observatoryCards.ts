export type ObservatoryCardRow = {
  label: string;
  value: string;
  badge?: string;
};

export type ObservatoryCard = {
  title: string;
  rows: ObservatoryCardRow[];
};

const SURVIVAL_STATUSES = ["survived", "weakened", "broken", "inconclusive"];
const STATUS_BADGES = new Set([
  "survived",
  "weakened",
  "broken",
  "inconclusive",
  "robust_candidate",
  "fragile_candidate",
  "promote_to_parent",
  "rename_or_split"
]);

export function buildObservatoryCards(path: string, content: string, kind: "markdown" | "json" | "text"): ObservatoryCard[] {
  if (kind === "markdown" && path.endsWith("report.md")) {
    return buildReportMarkdownCard(path, content);
  }
  if (kind !== "json") {
    return [];
  }

  const parsed = parseJson(content);
  if (!parsed) {
    return [];
  }

  if (path.endsWith("stats.json")) {
    return buildStatsCard(parsed);
  }
  if (path.endsWith("mutation_plan.json")) {
    return buildMutationPlanCard(parsed);
  }
  if (path.endsWith("survival_report.json")) {
    return buildSurvivalReportCard(parsed);
  }
  if (path.endsWith("mutation_result.json")) {
    return buildMutationResultCard(parsed);
  }
  if (path.endsWith("pattern_survival_index.json")) {
    return buildSurvivalIndexCard(parsed);
  }
  if (path.endsWith("evolution_parent_candidates.json")) {
    return buildEvolutionCandidatesCard(parsed);
  }
  if (path.endsWith("naming_debt_report.json")) {
    return buildNamingDebtCard(parsed);
  }
  return [];
}

function buildReportMarkdownCard(path: string, markdown: string): ObservatoryCard[] {
  const isMutationReport = /\/mutations\/MUT-[^/]+\/report\.md$/.test(path.replaceAll("\\", "/"));
  const rows = [
    row("Survival Status", sectionValue(markdown, "Survival Status"), badgeFor(sectionValue(markdown, "Survival Status"))),
    row("Best score", markdownValue(markdown, "Best score")),
    row("Average score", markdownValue(markdown, "Average score")),
    row("Best final state", markdownValue(markdown, "Best final state")),
    row("Best solver", markdownValue(markdown, "Best solver")),
    row("Distinct final states", markdownValue(markdown, "Distinct final states")),
    row("madowaku Name Candidate", markdownValue(markdown, "madowaku Name Candidate")),
    row("Cautions", hasSection(markdown, "Cautions") ? "present" : undefined)
  ].filter(hasValue);
  return rows.length > 0 ? [{ title: isMutationReport ? "Mutation Snapshot" : "Experiment Snapshot", rows }] : [];
}

function buildStatsCard(stats: any): ObservatoryCard[] {
  const rows = [
    row("bestScore", stats.bestScore),
    row("averageScore", stats.averageScore),
    row("bestFinalState", stats.bestFinalState),
    row("averageFinalLength", stats.averageFinalLength),
    row("distinctFinalStates", stats.distinctFinalStates),
    row("runCount", stats.runCount),
    row("top rule usage", topRuleUsage(stats.ruleUsage))
  ].filter(hasValue);
  return [{ title: "Solver Stats", rows }];
}

function buildMutationPlanCard(plan: any): ObservatoryCard[] {
  const changeTypes = Array.isArray(plan.mutations)
    ? [...new Set(plan.mutations.map((mutation: any) => mutation?.changeType).filter(Boolean))].join(", ")
    : undefined;
  return [{
    title: "Mutation Plan",
    rows: [
      row("Pattern", plan.sourcePattern?.name),
      row("Hypothesis", plan.hypothesis),
      row("Plan status", plan.planStatus, badgeFor(plan.planStatus)),
      row("Mutation count", Array.isArray(plan.mutations) ? plan.mutations.length : undefined),
      row("Change types", changeTypes)
    ].filter(hasValue)
  }];
}

function buildSurvivalReportCard(report: any): ObservatoryCard[] {
  const counts = countBy(Array.isArray(report.results) ? report.results.map((result: any) => result?.status) : [], SURVIVAL_STATUSES);
  return [{
    title: "Pattern Survival",
    rows: [
      row("Pattern", report.sourcePatternName),
      row("Overall status", report.overallStatus, badgeFor(report.overallStatus)),
      row("Hypothesis", report.hypothesis),
      row("Result count", Array.isArray(report.results) ? report.results.length : undefined),
      ...SURVIVAL_STATUSES.map((status) => row(status, counts[status], badgeFor(status)))
    ].filter(hasValue)
  }];
}

function buildMutationResultCard(result: any): ObservatoryCard[] {
  return [{
    title: "Mutation Result",
    rows: [
      row("mutationId", result.mutationId),
      row("title", result.title),
      row("changeType", result.changeType),
      row("status", result.status, badgeFor(result.status)),
      row("bestScoreDelta", result.comparison?.bestScoreDelta),
      row("averageScoreDelta", result.comparison?.averageScoreDelta),
      row("distinctFinalStatesDelta", result.comparison?.distinctFinalStatesDelta)
    ].filter(hasValue)
  }];
}

function buildSurvivalIndexCard(index: any): ObservatoryCard[] {
  const entries = Array.isArray(index.entries)
    ? [...index.entries].sort((left: any, right: any) => Number(right?.survivalScore ?? 0) - Number(left?.survivalScore ?? 0)).slice(0, 3)
    : [];
  return [{
    title: "Survival Index",
    rows: [
      row("experimentCount", index.experimentCount),
      row("mutationResultCount", index.mutationResultCount),
      ...SURVIVAL_STATUSES.map((status) => row(status, index.statusCounts?.[status], badgeFor(status))).filter(hasValue),
      row("entry count", Array.isArray(index.entries) ? index.entries.length : undefined),
      row("Top entries", entries.map((entry: any) => `${entry.patternName ?? "unknown"} (${formatScore(entry.survivalScore)} ${entry.survivalClass ?? ""})`).join("\n"))
    ].filter(hasValue)
  }];
}

function buildEvolutionCandidatesCard(report: any): ObservatoryCard[] {
  const candidates = Array.isArray(report.candidates) ? report.candidates.slice(0, 3) : [];
  return [{
    title: "Evolution Candidates",
    rows: [
      row("candidateCount", report.candidateCount),
      row("promote_to_parent", report.decisionCounts?.promote_to_parent, badgeFor("promote_to_parent")),
      row("watchlist", report.decisionCounts?.watchlist),
      row("rename_or_split", report.decisionCounts?.rename_or_split, badgeFor("rename_or_split")),
      row("needs_more_tests", report.decisionCounts?.needs_more_tests),
      row("Top candidates", candidates.map((candidate: any) => `${candidate.patternName ?? "unknown"} (${candidate.decision ?? "unknown"}, ${formatScore(candidate.survivalScore)})`).join("\n"))
    ].filter(hasValue)
  }];
}

function buildNamingDebtCard(report: any): ObservatoryCard[] {
  const entries = Array.isArray(report.entries) ? report.entries : [];
  const debtReasons = countBy(entries.flatMap((entry: any) => Array.isArray(entry.debtReasons) ? entry.debtReasons : []));
  const nextActions = countBy(entries.map((entry: any) => entry.nextAction).filter(Boolean));
  const names = entries.flatMap((entry: any) => Array.isArray(entry.narrowerNameCandidates) ? entry.narrowerNameCandidates : []).slice(0, 3);
  return [{
    title: "Naming Debt",
    rows: [
      row("entryCount", report.entryCount),
      ...Object.entries(debtReasons).map(([label, value]) => row(label, value)),
      ...Object.entries(nextActions).map(([label, value]) => row(label, value)),
      row("Narrower names", names.join("\n"))
    ].filter(hasValue)
  }];
}

function parseJson(content: string): any | undefined {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function markdownValue(markdown: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^-\\s*${escaped}\\s*:\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "im"),
    new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`, "i")
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function sectionValue(markdown: string, heading: string): string | undefined {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*\\n+([^#\\n][^\\n]*)`, "im"));
  return match?.[1]?.trim();
}

function hasSection(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "im").test(markdown);
}

function row(label: string, value: unknown, badge?: string): ObservatoryCardRow {
  return { label, value: stringifyValue(value), badge };
}

function hasValue(row: ObservatoryCardRow): boolean {
  return row.value !== "unknown" && row.value !== "";
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "unknown";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function badgeFor(value: unknown): string | undefined {
  const text = stringifyValue(value);
  return STATUS_BADGES.has(text) ? text : undefined;
}

function countBy(values: any[], knownValues?: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const known of knownValues ?? []) {
    counts[known] = 0;
  }
  for (const value of values) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const key = String(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function topRuleUsage(ruleUsage: unknown): string | undefined {
  if (!ruleUsage || typeof ruleUsage !== "object") {
    return undefined;
  }
  const entries = Object.entries(ruleUsage as Record<string, number>)
    .sort((left, right) => Number(right[1]) - Number(left[1]));
  const [ruleId, count] = entries[0] ?? [];
  return ruleId ? `${ruleId}: ${count}` : undefined;
}

function formatScore(score: unknown): string {
  return typeof score === "number" ? score.toFixed(2) : "unknown";
}
