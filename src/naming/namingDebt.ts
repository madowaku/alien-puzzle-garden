import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  EvolutionParentCandidate,
  EvolutionParentCandidatesReport,
  NamingDebtEntry,
  NamingDebtReason,
  NamingDebtReport,
  PatternSurvivalIndex,
  PatternSurvivalIndexEntry
} from "../mutations/mutationTypes.ts";

export type BuildNamingDebtOptions = {
  includeWatchlist?: boolean;
  sourceCandidatesPath?: string;
  sourceIndexPath?: string;
};

const BROAD_WORDS = ["Bottleneck", "Gate", "Attractor", "Core", "Drift", "Pressure"];
const ENTRY_DECISION_ORDER = ["rename_or_split", "needs_more_tests", "watchlist"];

export async function writeNamingDebtReport(experimentsDir: string, options: BuildNamingDebtOptions = {}): Promise<NamingDebtReport | "missing-candidates" | "missing-index"> {
  const sourceCandidatesPath = join(experimentsDir, "evolution_parent_candidates.json");
  const sourceIndexPath = join(experimentsDir, "pattern_survival_index.json");

  let candidatesReport: EvolutionParentCandidatesReport;
  try {
    candidatesReport = JSON.parse(await readFile(sourceCandidatesPath, "utf8")) as EvolutionParentCandidatesReport;
  } catch {
    return "missing-candidates";
  }

  let survivalIndex: PatternSurvivalIndex;
  try {
    survivalIndex = JSON.parse(await readFile(sourceIndexPath, "utf8")) as PatternSurvivalIndex;
  } catch {
    return "missing-index";
  }

  const report = buildNamingDebtReport(candidatesReport, survivalIndex, {
    includeWatchlist: options.includeWatchlist ?? false,
    sourceCandidatesPath: options.sourceCandidatesPath ?? sourceCandidatesPath,
    sourceIndexPath: options.sourceIndexPath ?? sourceIndexPath
  });

  await mkdir(experimentsDir, { recursive: true });
  await writeFile(join(experimentsDir, "naming_debt_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "naming_debt_report.md"), renderNamingDebtMarkdown(report), "utf8");
  return report;
}

export function buildNamingDebtReport(
  candidatesReport: EvolutionParentCandidatesReport,
  survivalIndex: PatternSurvivalIndex,
  options: BuildNamingDebtOptions = {}
): NamingDebtReport {
  const indexByName = new Map(survivalIndex.entries.map((entry) => [entry.patternName, entry]));
  const entries = candidatesReport.candidates
    .filter((candidate) => shouldInclude(candidate, options.includeWatchlist ?? false))
    .map((candidate) => buildEntry(candidate, indexByName.get(candidate.patternName)))
    .sort(compareEntries);

  return {
    generatedAt: candidatesReport.generatedAt.startsWith("deterministic:")
      ? candidatesReport.generatedAt
      : `deterministic:${candidatesReport.generatedAt}`,
    sourceCandidatesPath: options.sourceCandidatesPath ?? "evolution_parent_candidates.json",
    sourceIndexPath: options.sourceIndexPath ?? "pattern_survival_index.json",
    entryCount: entries.length,
    entries,
    cautions: [
      "Naming debt is not failure.",
      "A broken name tells us where the observation was too broad.",
      "This report is deterministic and does not call an LLM."
    ]
  };
}

export function renderNamingDebtMarkdown(report: NamingDebtReport): string {
  return `# Naming Debt Report

## Summary

- Entries: ${report.entryCount}
- Source candidates: ${report.sourceCandidatesPath}
- Source index: ${report.sourceIndexPath}

## Entries

${report.entries.map(renderEntry).join("\n\n")}

## Observatory Note

A name is not wrong because it breaks.
A broken name tells us where the observation was too broad.

Naming debt is paid down by narrower names, sharper tests, or more mutation pressure.

## Cautions

${report.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function shouldInclude(candidate: EvolutionParentCandidate, includeWatchlist: boolean): boolean {
  if (candidate.decision === "promote_to_parent") {
    return false;
  }
  if (candidate.decision === "watchlist") {
    return includeWatchlist;
  }
  return candidate.decision === "rename_or_split" || candidate.decision === "needs_more_tests";
}

function buildEntry(candidate: EvolutionParentCandidate, indexEntry?: PatternSurvivalIndexEntry): NamingDebtEntry {
  const fragileAgainst = indexEntry?.fragileAgainst ?? candidate.fragileAgainst;
  const robustAgainst = indexEntry?.robustAgainst ?? candidate.robustAgainst;
  const commonMutationTypes = indexEntry?.commonMutationTypes ?? [];
  const debtReasons = detectReasons(candidate, fragileAgainst, robustAgainst, commonMutationTypes);
  const narrowerNameCandidates = generateNameCandidates(candidate.patternName, fragileAgainst, candidate.decision, candidate.survivalClass);
  const suggestedSplit = generateSuggestedSplit(candidate.patternName, fragileAgainst, debtReasons);

  return {
    patternName: candidate.patternName,
    sourceDecision: candidate.decision,
    survivalScore: candidate.survivalScore,
    survivalClass: candidate.survivalClass,
    mutationResultCount: candidate.mutationResultCount,
    debtReasons,
    fragileAgainst,
    robustAgainst,
    diagnosis: buildDiagnosis(candidate.patternName, debtReasons),
    narrowerNameCandidates,
    suggestedSplit,
    nextAction: nextActionFor(candidate.decision, debtReasons),
    cautions: [
      "This diagnosis is a deterministic naming aid, not a semantic proof.",
      "Narrower names still need mutation tests."
    ]
  };
}

function detectReasons(
  candidate: EvolutionParentCandidate,
  fragileAgainst: string[],
  robustAgainst: string[],
  commonMutationTypes: string[]
): NamingDebtReason[] {
  const reasons = new Set<NamingDebtReason>();
  if (candidate.decision === "needs_more_tests" || candidate.mutationResultCount < 3) {
    reasons.add("under_evidenced");
  }
  if (candidate.survivalClass === "fragile_candidate" || candidate.survivalScore < 0.4) {
    reasons.add("mutation_sensitive");
  }
  if (containsAny(fragileAgainst, ["remove_rule", "alter_rule_output", "alter_rule_input"])) {
    reasons.add("rule_attached");
  }
  if (containsAny([...fragileAgainst, ...commonMutationTypes], ["change_scoring_hint"])) {
    reasons.add("score_attached");
  }
  if (containsAny([...fragileAgainst, ...commonMutationTypes], ["change_solver_mix", "increase_random_runs"])) {
    reasons.add("solver_attached");
  }
  if (BROAD_WORDS.some((word) => candidate.patternName.includes(word)) && (candidate.survivalClass === "fragile_candidate" || candidate.survivalClass === "unstable_candidate")) {
    reasons.add("too_broad");
  }
  if (fragileAgainst.length > 1 || (fragileAgainst.length > 0 && robustAgainst.length > 0)) {
    reasons.add("split_candidate");
  }
  return [...reasons].sort();
}

function generateNameCandidates(patternName: string, fragileAgainst: string[], decision: EvolutionParentCandidate["decision"], survivalClass: EvolutionParentCandidate["survivalClass"]): string[] {
  const names: string[] = [];
  if (decision === "needs_more_tests" || survivalClass === "under_tested") {
    names.push(`Unconfirmed ${patternName}`, `${patternName} Probe`, `${patternName} Candidate`);
  }
  if (fragileAgainst.includes("remove_rule")) {
    names.push(`Rule-Local ${patternName}`, `Removal-Sensitive ${replaceBroadTail(patternName, "Gate")}`, `Fragile ${replaceBroadHead(patternName, "Rewrite Pressure")}`);
  }
  if (fragileAgainst.includes("alter_rule_output")) {
    names.push("Output-Dependent Gate", "Rewrite Output Fragility", "Symbol Output Bottleneck");
  }
  if (fragileAgainst.includes("alter_rule_input")) {
    names.push("Input-Dependent Gate", "Rewrite Input Fragility", "Symbol Input Bottleneck");
  }
  if (fragileAgainst.includes("increase_random_runs") || fragileAgainst.includes("change_solver_mix")) {
    names.push("Solver-Sensitive Pattern", `${patternName} Solver Probe`);
  }
  if (fragileAgainst.includes("change_scoring_hint")) {
    names.push("Score-Attached Pattern", `${patternName} Score Probe`);
  }
  if (names.length === 0) {
    names.push(`Narrow ${patternName}`, `${patternName} Probe`, `${patternName} Fragment`);
  }
  return [...new Set(names)].slice(0, 6);
}

function generateSuggestedSplit(patternName: string, fragileAgainst: string[], reasons: NamingDebtReason[]): NamingDebtEntry["suggestedSplit"] {
  const candidates = generateNameCandidates(patternName, fragileAgainst, "rename_or_split", "fragile_candidate").slice(0, reasons.includes("split_candidate") ? 3 : 2);
  return candidates.map((name) => ({
    name,
    rationale: `${name} narrows ${patternName} toward a specific mutation pressure instead of treating it as one broad phenomenon.`,
    nextTest: `Create a follow-up mutation plan that isolates ${name} and rerun mutation-run.`
  }));
}

function buildDiagnosis(patternName: string, reasons: NamingDebtReason[]): string {
  if (reasons.includes("under_evidenced")) {
    return `${patternName} has too little mutation pressure to carry its current name confidently.`;
  }
  if (reasons.includes("rule_attached") && reasons.includes("too_broad")) {
    return `${patternName} may be naming a broad phenomenon when the current evidence is attached to specific rewrite-rule changes.`;
  }
  if (reasons.includes("split_candidate")) {
    return `${patternName} reacts differently across mutation pressures, so the name may need to split into smaller observations.`;
  }
  return `${patternName} remains useful as a label, but its explanation boundary needs sharper tests.`;
}

function nextActionFor(decision: EvolutionParentCandidate["decision"], reasons: NamingDebtReason[]): NamingDebtEntry["nextAction"] {
  if (reasons.includes("under_evidenced")) {
    return "collect_more_mutations";
  }
  if (decision === "watchlist") {
    return "keep_observing";
  }
  if (reasons.includes("split_candidate")) {
    return "split";
  }
  return "rename";
}

function renderEntry(entry: NamingDebtEntry): string {
  return `### ${entry.patternName}

Decision: ${entry.sourceDecision}
Class: ${entry.survivalClass}
Survival score: ${entry.survivalScore.toFixed(2)}
Mutation results: ${entry.mutationResultCount}

Debt reasons:
${formatList(entry.debtReasons)}

Diagnosis:
${entry.diagnosis}

Narrower name candidates:
${formatList(entry.narrowerNameCandidates)}

Suggested split:
${entry.suggestedSplit.map((split) => `#### ${split.name}

Rationale:
${split.rationale}

Next test:
${split.nextTest}`).join("\n\n")}

Next action:
${entry.nextAction}

Cautions:
${entry.cautions.map((caution) => `- ${caution}`).join("\n")}`;
}

function containsAny(items: string[], targets: string[]): boolean {
  return targets.some((target) => items.includes(target));
}

function replaceBroadTail(patternName: string, fallback: string): string {
  const parts = patternName.split(/\s+/);
  parts[parts.length - 1] = fallback;
  return parts.join(" ");
}

function replaceBroadHead(patternName: string, fallback: string): string {
  return patternName.includes("Rewrite") ? patternName : fallback;
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none observed";
}

function compareEntries(left: NamingDebtEntry, right: NamingDebtEntry): number {
  const decisionDelta = ENTRY_DECISION_ORDER.indexOf(left.sourceDecision) - ENTRY_DECISION_ORDER.indexOf(right.sourceDecision);
  return decisionDelta || left.patternName.localeCompare(right.patternName);
}
