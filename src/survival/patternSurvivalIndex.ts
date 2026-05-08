import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listExperimentDirs } from "../io/readExperimentFiles.ts";
import type {
  MutationChangeType,
  PatternSurvivalClass,
  PatternSurvivalIndex,
  PatternSurvivalIndexEntry,
  SurvivalReport,
  SurvivalStatus
} from "../mutations/mutationTypes.ts";

const STATUS_WEIGHTS: Record<SurvivalStatus, number> = {
  survived: 1,
  weakened: 0.5,
  inconclusive: 0.25,
  broken: 0
};

const STATUS_ORDER: SurvivalStatus[] = ["survived", "weakened", "broken", "inconclusive"];

export type BuildPatternSurvivalIndexOptions = {
  minRuns?: number;
};

export async function writePatternSurvivalIndex(experimentsDir: string, options: BuildPatternSurvivalIndexOptions = {}): Promise<PatternSurvivalIndex | null> {
  const reports = await readSurvivalReports(experimentsDir);
  if (reports.length === 0) {
    return null;
  }

  const index = buildPatternSurvivalIndex(reports, options);
  await mkdir(experimentsDir, { recursive: true });
  await writeFile(join(experimentsDir, "pattern_survival_index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "pattern_survival_index.md"), renderPatternSurvivalIndexMarkdown(index), "utf8");
  return index;
}

export async function readSurvivalReports(experimentsDir: string): Promise<SurvivalReport[]> {
  let experimentDirs: string[];
  try {
    experimentDirs = await listExperimentDirs(experimentsDir);
  } catch {
    return [];
  }

  const reports: SurvivalReport[] = [];
  for (const experimentDir of experimentDirs) {
    try {
      const text = await readFile(join(experimentDir, "survival_report.json"), "utf8");
      reports.push(JSON.parse(text) as SurvivalReport);
    } catch {
      // Malformed or missing reports are skipped so one bad experiment does not block the index.
    }
  }
  return reports;
}

export function buildPatternSurvivalIndex(reports: SurvivalReport[], options: BuildPatternSurvivalIndexOptions = {}): PatternSurvivalIndex {
  const minRuns = options.minRuns ?? 2;
  const groups = new Map<string, SurvivalReport[]>();
  for (const report of reports) {
    const existing = groups.get(report.sourcePatternName) ?? [];
    existing.push(report);
    groups.set(report.sourcePatternName, existing);
  }

  const entries = [...groups.entries()]
    .map(([patternName, patternReports]) => buildEntry(patternName, patternReports, minRuns))
    .sort((left, right) => right.survivalScore - left.survivalScore || left.patternName.localeCompare(right.patternName));

  return {
    generatedAt: `deterministic:${reports.map((report) => report.sourceExperimentId).sort().join(",")}`,
    experimentCount: reports.length,
    mutationResultCount: entries.reduce((sum, entry) => sum + entry.mutationResultCount, 0),
    statusCounts: countStatuses(reports.flatMap((report) => report.results.map((result) => result.status))),
    entries,
    cautions: [
      "This index does not prove a pattern.",
      "It only summarizes how named candidates behaved under local mutation pressure.",
      "Robust candidates are prompts for more experiments, not mathematical results."
    ]
  };
}

export function renderPatternSurvivalIndexMarkdown(index: PatternSurvivalIndex): string {
  return `# Pattern Survival Index

## Summary

- Experiments indexed: ${index.experimentCount}
- Mutation results indexed: ${index.mutationResultCount}

## Status Counts

${STATUS_ORDER.map((status) => `- ${status}: ${index.statusCounts[status]}`).join("\n")}

## Pattern Entries

${index.entries.map(renderEntry).join("\n\n")}

## Observatory Note

This index does not prove a pattern.
It only summarizes how named candidates behaved under local mutation pressure.
Survival under mutation is a reason to keep testing, not a theorem.

## Cautions

${index.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function buildEntry(patternName: string, reports: SurvivalReport[], minRuns: number): PatternSurvivalIndexEntry {
  const results = reports.flatMap((report) => report.results);
  const statusCounts = countStatuses(results.map((result) => result.status));
  const survivalScore = round2(results.reduce((sum, result) => sum + STATUS_WEIGHTS[result.status], 0) / Math.max(1, results.length));
  const survivalClass = classifySurvival(survivalScore, results.length, minRuns);

  return {
    patternName,
    sourceExperimentIds: [...new Set(reports.map((report) => report.sourceExperimentId))].sort(),
    mutationResultCount: results.length,
    statusCounts,
    survivalScore,
    survivalClass,
    robustAgainst: mutationPressure(results, "robust"),
    fragileAgainst: mutationPressure(results, "fragile"),
    commonMutationTypes: commonMutationTypes(results.map((result) => result.changeType)),
    recommendation: recommendationFor(survivalClass),
    notes: [
      `${patternName} is a local pattern candidate, not a proven invariant.`,
      `Survival score is based on ${results.length} mutation result(s).`
    ]
  };
}

function renderEntry(entry: PatternSurvivalIndexEntry): string {
  return `### ${entry.patternName}

Class: ${entry.survivalClass}
Survival score: ${entry.survivalScore.toFixed(2)}
Experiments: ${entry.sourceExperimentIds.join(", ")}

Status counts:
${STATUS_ORDER.map((status) => `- ${status}: ${entry.statusCounts[status]}`).join("\n")}

Robust against:
${formatList(entry.robustAgainst)}

Fragile against:
${formatList(entry.fragileAgainst)}

Common mutation types:
${formatList(entry.commonMutationTypes)}

Recommendation:
${entry.recommendation}

Notes:
${entry.notes.map((note) => `- ${note}`).join("\n")}`;
}

function countStatuses(statuses: SurvivalStatus[]): Record<SurvivalStatus, number> {
  const counts: Record<SurvivalStatus, number> = {
    survived: 0,
    weakened: 0,
    broken: 0,
    inconclusive: 0
  };
  for (const status of statuses) {
    counts[status] += 1;
  }
  return counts;
}

function classifySurvival(score: number, mutationResultCount: number, minRuns: number): PatternSurvivalClass {
  if (mutationResultCount < minRuns) {
    return "under_tested";
  }
  if (score >= 0.75) {
    return "robust_candidate";
  }
  if (score >= 0.4) {
    return "unstable_candidate";
  }
  return "fragile_candidate";
}

function mutationPressure(results: SurvivalReport["results"], mode: "robust" | "fragile"): string[] {
  const byType = new Map<MutationChangeType, SurvivalStatus[]>();
  for (const result of results) {
    const statuses = byType.get(result.changeType) ?? [];
    statuses.push(result.status);
    byType.set(result.changeType, statuses);
  }

  return [...byType.entries()]
    .filter(([, statuses]) => {
      const strong = statuses.filter((status) => status === "survived" || status === "weakened").length;
      const broken = statuses.filter((status) => status === "broken").length;
      return mode === "robust" ? strong > broken : broken > strong;
    })
    .map(([changeType]) => changeType)
    .sort();
}

function commonMutationTypes(changeTypes: MutationChangeType[]): string[] {
  const counts = new Map<MutationChangeType, number>();
  for (const changeType of changeTypes) {
    counts.set(changeType, (counts.get(changeType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([changeType]) => changeType);
}

function recommendationFor(survivalClass: PatternSurvivalClass): PatternSurvivalIndexEntry["recommendation"] {
  if (survivalClass === "robust_candidate") {
    return "promote_to_evolution_parent";
  }
  if (survivalClass === "fragile_candidate") {
    return "rename_or_split_pattern";
  }
  if (survivalClass === "under_tested") {
    return "collect_more_data";
  }
  return "rerun_with_more_mutations";
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none observed";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
