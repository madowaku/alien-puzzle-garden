import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  EvolutionCandidateDecision,
  EvolutionParentCandidate,
  EvolutionParentCandidatesReport,
  PatternSurvivalIndex,
  PatternSurvivalIndexEntry
} from "../mutations/mutationTypes.ts";

export type BuildEvolutionCandidatesOptions = {
  minScore?: number;
  minResults?: number;
  sourceIndexPath?: string;
};

const DECISION_ORDER: EvolutionCandidateDecision[] = [
  "promote_to_parent",
  "watchlist",
  "rename_or_split",
  "needs_more_tests"
];

export async function writeEvolutionParentCandidates(experimentsDir: string, options: BuildEvolutionCandidatesOptions = {}): Promise<EvolutionParentCandidatesReport | null> {
  const sourceIndexPath = join(experimentsDir, "pattern_survival_index.json");
  let index: PatternSurvivalIndex;
  try {
    index = JSON.parse(await readFile(sourceIndexPath, "utf8")) as PatternSurvivalIndex;
  } catch {
    return null;
  }

  const report = buildEvolutionParentCandidatesReport(index, {
    minScore: options.minScore ?? 0.75,
    minResults: options.minResults ?? 3,
    sourceIndexPath: options.sourceIndexPath ?? sourceIndexPath
  });

  await mkdir(experimentsDir, { recursive: true });
  await writeFile(join(experimentsDir, "evolution_parent_candidates.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "evolution_parent_candidates.md"), renderEvolutionParentCandidatesMarkdown(report), "utf8");
  return report;
}

export function buildEvolutionParentCandidatesReport(index: PatternSurvivalIndex, options: BuildEvolutionCandidatesOptions = {}): EvolutionParentCandidatesReport {
  const minScore = options.minScore ?? 0.75;
  const minResults = options.minResults ?? 3;
  const candidates = index.entries
    .map((entry) => buildCandidate(entry, minScore, minResults))
    .sort(compareCandidates);

  return {
    generatedAt: index.generatedAt.startsWith("deterministic:")
      ? index.generatedAt
      : `deterministic:${index.generatedAt}`,
    sourceIndexPath: options.sourceIndexPath ?? "pattern_survival_index.json",
    candidateCount: candidates.length,
    decisionCounts: countDecisions(candidates),
    candidates,
    cautions: [
      "Parent selection is not proof of mathematical importance.",
      "This report only prepares future puzzle evolution; it does not mutate puzzles.",
      "Fragile and under-tested candidates are useful signals, not failures."
    ]
  };
}

export function renderEvolutionParentCandidatesMarkdown(report: EvolutionParentCandidatesReport): string {
  return `# Evolution Parent Candidates

## Summary

- Candidates: ${report.candidateCount}
- Source index: ${report.sourceIndexPath}

## Decision Counts

${DECISION_ORDER.map((decision) => `- ${decision}: ${report.decisionCounts[decision]}`).join("\n")}

## Candidates

${report.candidates.map(renderCandidate).join("\n\n")}

## Observatory Note

Parent selection is not proof of mathematical importance.
It is only a local selection signal for future puzzle evolution.

Robust candidates may become evolution parents.
Fragile candidates may become better names after splitting.
Under-tested candidates need more mutation pressure.

## Cautions

${report.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function buildCandidate(entry: PatternSurvivalIndexEntry, minScore: number, minResults: number): EvolutionParentCandidate {
  const decision = decide(entry, minScore, minResults);
  return {
    patternName: entry.patternName,
    decision,
    survivalScore: entry.survivalScore,
    survivalClass: entry.survivalClass,
    mutationResultCount: entry.mutationResultCount,
    sourceExperimentIds: entry.sourceExperimentIds,
    robustAgainst: entry.robustAgainst,
    fragileAgainst: entry.fragileAgainst,
    recommendation: entry.recommendation,
    rationale: rationaleFor(entry, decision, minScore, minResults),
    nextAction: nextActionFor(decision),
    cautions: [
      "This is a local selection signal, not proof.",
      "Future evolution should keep deterministic logs for comparison."
    ]
  };
}

function decide(entry: PatternSurvivalIndexEntry, minScore: number, minResults: number): EvolutionCandidateDecision {
  if (entry.survivalClass === "under_tested" || entry.mutationResultCount < minResults) {
    return "needs_more_tests";
  }
  if (entry.survivalClass === "robust_candidate" && entry.survivalScore >= minScore) {
    return "promote_to_parent";
  }
  if (entry.survivalClass === "fragile_candidate") {
    return "rename_or_split";
  }
  return "watchlist";
}

function rationaleFor(entry: PatternSurvivalIndexEntry, decision: EvolutionCandidateDecision, minScore: number, minResults: number): string {
  if (decision === "promote_to_parent") {
    return `${entry.patternName} met the local parent threshold: score ${entry.survivalScore.toFixed(2)} >= ${minScore.toFixed(2)} with ${entry.mutationResultCount} mutation result(s).`;
  }
  if (decision === "needs_more_tests") {
    return `${entry.patternName} has ${entry.mutationResultCount} mutation result(s), below the ${minResults} result threshold or marked under-tested.`;
  }
  if (decision === "rename_or_split") {
    return `${entry.patternName} is fragile under current mutation pressure; the name may be too broad or attached to a brittle mechanism.`;
  }
  return `${entry.patternName} is observable but not stable enough for parent selection under the current thresholds.`;
}

function nextActionFor(decision: EvolutionCandidateDecision): string {
  if (decision === "promote_to_parent") {
    return "Use as a possible parent candidate in a future self-play evolution batch.";
  }
  if (decision === "watchlist") {
    return "Run more mutation pressure before promoting.";
  }
  if (decision === "rename_or_split") {
    return "Try a narrower name or split the pattern into smaller candidates.";
  }
  return "Collect more survival reports before making a selection decision.";
}

function renderCandidate(candidate: EvolutionParentCandidate): string {
  return `### ${candidate.patternName}

Decision: ${candidate.decision}
Survival score: ${candidate.survivalScore.toFixed(2)}
Class: ${candidate.survivalClass}
Mutation results: ${candidate.mutationResultCount}
Experiments: ${candidate.sourceExperimentIds.join(", ")}

Rationale:
${candidate.rationale}

Next action:
${candidate.nextAction}

Robust against:
${formatList(candidate.robustAgainst)}

Fragile against:
${formatList(candidate.fragileAgainst)}

Cautions:
${candidate.cautions.map((caution) => `- ${caution}`).join("\n")}`;
}

function countDecisions(candidates: EvolutionParentCandidate[]): Record<EvolutionCandidateDecision, number> {
  const counts: Record<EvolutionCandidateDecision, number> = {
    promote_to_parent: 0,
    watchlist: 0,
    rename_or_split: 0,
    needs_more_tests: 0
  };
  for (const candidate of candidates) {
    counts[candidate.decision] += 1;
  }
  return counts;
}

function compareCandidates(left: EvolutionParentCandidate, right: EvolutionParentCandidate): number {
  const decisionDelta = DECISION_ORDER.indexOf(left.decision) - DECISION_ORDER.indexOf(right.decision);
  return decisionDelta || right.survivalScore - left.survivalScore || left.patternName.localeCompare(right.patternName);
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none observed";
}
