import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { computeStats } from "../experiments/runExperiment.ts";
import { buildMarkdownReport } from "../reports/buildMarkdownReport.ts";
import { runBeamSearchSolver } from "../solvers/beamSearchSolver.ts";
import { runGreedySolver } from "../solvers/greedySolver.ts";
import { runRandomSolver } from "../solvers/randomSolver.ts";
import type { ExperimentStats, SolverRun, SymbolRewritePuzzle } from "../types.ts";
import type { MutationPlan, MutationResult, SurvivalReport, SurvivalStatus } from "./mutationTypes.ts";

type Mutation = MutationPlan["mutations"][number];

type ApplyMutationResult = {
  puzzle: SymbolRewritePuzzle;
  randomRuns: number;
  runnable: boolean;
  cautions: string[];
};

export async function runMutationPlanForExperiment(experimentDir: string): Promise<SurvivalReport> {
  const planPath = join(experimentDir, "mutation_plan.json");
  let plan: MutationPlan;
  try {
    plan = JSON.parse(await readFile(planPath, "utf8")) as MutationPlan;
  } catch {
    throw new Error(`No mutation_plan.json found for ${experimentDir.split(/[\\/]/).at(-1)}. Run npm run mutation-plan first.`);
  }

  const sourcePuzzle = JSON.parse(await readFile(join(experimentDir, "puzzle.json"), "utf8")) as SymbolRewritePuzzle;
  const sourceStats = JSON.parse(await readFile(join(experimentDir, "stats.json"), "utf8")) as ExperimentStats;
  const results: MutationResult[] = [];

  for (const mutation of plan.mutations) {
    const result = await runSingleMutation(experimentDir, plan, sourcePuzzle, sourceStats, mutation);
    results.push(result);
  }

  const report = buildSurvivalReport(plan, results);
  await writeFile(join(experimentDir, "survival_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(experimentDir, "survival_report.md"), renderSurvivalReportMarkdown(report), "utf8");
  return report;
}

export async function runSingleMutation(
  experimentDir: string,
  plan: MutationPlan,
  sourcePuzzle: SymbolRewritePuzzle,
  sourceStats: ExperimentStats,
  mutation: Mutation
): Promise<MutationResult> {
  const mutationDir = join(experimentDir, "mutations", mutation.id);
  await mkdir(mutationDir, { recursive: true });

  const applied = applyMutation(sourcePuzzle, sourceStats, mutation);
  const mutatedPuzzleId = `${sourcePuzzle.id}-${mutation.id}`;
  const mutatedPuzzle = { ...applied.puzzle, id: mutatedPuzzleId };
  let runs: SolverRun[] = [];
  let stats: ExperimentStats = emptyStats(mutatedPuzzleId, sourceStats.seed + mutationSeedOffset(mutation.id));
  let reportMarkdown = "";

  if (applied.runnable) {
    runs = runSolverSuite(mutatedPuzzle, applied.randomRuns, sourceStats.seed + mutationSeedOffset(mutation.id));
    stats = computeStats(mutatedPuzzleId, sourceStats.seed + mutationSeedOffset(mutation.id), runs);
    reportMarkdown = buildMarkdownReport(mutatedPuzzle, stats);
  } else {
    reportMarkdown = `# Mutation Result: ${mutation.id}

Mutation could not be run.

${applied.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
  }

  const result = buildMutationResult(plan, sourceStats, stats, mutation, mutatedPuzzleId, applied.cautions, applied.runnable);
  await writeFile(join(mutationDir, "mutated_puzzle.json"), `${JSON.stringify(mutatedPuzzle, null, 2)}\n`, "utf8");
  await writeFile(join(mutationDir, "solver_runs.json"), `${JSON.stringify(runs, null, 2)}\n`, "utf8");
  await writeFile(join(mutationDir, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  await writeFile(join(mutationDir, "mutation_result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(join(mutationDir, "report.md"), renderMutationResultMarkdown(result, mutatedPuzzle, reportMarkdown), "utf8");
  return result;
}

export function applyMutation(sourcePuzzle: SymbolRewritePuzzle, sourceStats: ExperimentStats, mutation: Mutation): ApplyMutationResult {
  const puzzle: SymbolRewritePuzzle = {
    ...sourcePuzzle,
    rules: sourcePuzzle.rules.map((rule) => ({ ...rule })),
    alphabet: [...sourcePuzzle.alphabet],
    scoreHints: [...sourcePuzzle.scoreHints]
  };
  const cautions: string[] = [];
  let randomRuns = 50;

  switch (mutation.changeType) {
    case "remove_rule": {
      const ruleId = String(mutation.change.ruleId ?? "");
      const before = puzzle.rules.length;
      puzzle.rules = puzzle.rules.filter((rule) => rule.id !== ruleId);
      if (puzzle.rules.length === before) {
        cautions.push(`Rule ${ruleId || "(missing)"} was not found.`);
        return { puzzle, randomRuns, runnable: false, cautions };
      }
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "alter_rule_output": {
      const rule = findRule(puzzle, mutation);
      if (!rule) {
        cautions.push("Target rule for alter_rule_output was not found.");
        return { puzzle, randomRuns, runnable: false, cautions };
      }
      rule.to = String(mutation.change.replaceOutputWith ?? pickAlternateSymbol(puzzle, rule.to));
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "alter_rule_input": {
      const rule = findRule(puzzle, mutation);
      if (!rule) {
        cautions.push("Target rule for alter_rule_input was not found.");
        return { puzzle, randomRuns, runnable: false, cautions };
      }
      rule.from = String(mutation.change.replaceInputWith ?? pickAlternateSymbol(puzzle, rule.from));
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "seed_initial_symbol": {
      const symbol = String(mutation.change.symbol ?? selectSymbolFromBestState(puzzle, sourceStats));
      const rawIndex = typeof mutation.change.index === "number" ? mutation.change.index : Math.floor(puzzle.initial.length / 2);
      const index = Math.max(0, Math.min(puzzle.initial.length, rawIndex));
      puzzle.initial = `${puzzle.initial.slice(0, index)}${symbol}${puzzle.initial.slice(index)}`;
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "remove_initial_symbol": {
      const symbol = String(mutation.change.symbol ?? selectSymbolFromBestState(puzzle, sourceStats));
      const index = puzzle.initial.indexOf(symbol);
      if (index === -1) {
        cautions.push(`Initial string does not contain symbol ${symbol}.`);
        return { puzzle, randomRuns, runnable: false, cautions };
      }
      puzzle.initial = `${puzzle.initial.slice(0, index)}${puzzle.initial.slice(index + symbol.length)}`;
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "change_max_steps": {
      const planned = mutation.change.newMaxSteps;
      puzzle.maxSteps = typeof planned === "number" && planned > 0 ? planned : Math.max(1, Math.ceil(puzzle.maxSteps * 1.5));
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    case "increase_random_runs": {
      randomRuns = typeof mutation.change.suggestedRandomRuns === "number"
        ? Math.max(1, Math.floor(mutation.change.suggestedRandomRuns))
        : 100;
      return { puzzle, randomRuns, runnable: true, cautions };
    }
    default:
      cautions.push(`Unsupported mutation change type: ${mutation.changeType}.`);
      return { puzzle, randomRuns, runnable: false, cautions };
  }
}

function runSolverSuite(puzzle: SymbolRewritePuzzle, randomRuns: number, seed: number): SolverRun[] {
  const runs: SolverRun[] = [];
  for (let index = 0; index < randomRuns; index += 1) {
    runs.push(runRandomSolver(puzzle, {
      runId: `random-${String(index + 1).padStart(3, "0")}`,
      seed: seed * 1000 + index
    }));
  }
  runs.push(runGreedySolver(puzzle, { runId: "greedy-001" }));
  runs.push(runBeamSearchSolver(puzzle, { runId: "beam-001", beamWidth: 6 }));
  return runs;
}

function buildMutationResult(
  plan: MutationPlan,
  sourceStats: ExperimentStats,
  mutatedStats: ExperimentStats,
  mutation: Mutation,
  mutatedPuzzleId: string,
  cautions: string[],
  runnable: boolean
): MutationResult {
  const comparison = {
    sourceBestScore: sourceStats.bestScore,
    mutatedBestScore: mutatedStats.bestScore,
    bestScoreDelta: mutatedStats.bestScore - sourceStats.bestScore,
    sourceAverageScore: sourceStats.averageScore,
    mutatedAverageScore: mutatedStats.averageScore,
    averageScoreDelta: mutatedStats.averageScore - sourceStats.averageScore,
    sourceDistinctFinalStates: sourceStats.distinctFinalStates,
    mutatedDistinctFinalStates: mutatedStats.distinctFinalStates,
    distinctFinalStatesDelta: mutatedStats.distinctFinalStates - sourceStats.distinctFinalStates,
    sourceAverageFinalLength: sourceStats.averageFinalLength,
    mutatedAverageFinalLength: mutatedStats.averageFinalLength,
    averageFinalLengthDelta: mutatedStats.averageFinalLength - sourceStats.averageFinalLength
  };
  const status = runnable ? classifySurvival(comparison) : "inconclusive";
  return {
    sourceExperimentId: plan.sourceExperimentId,
    mutationId: mutation.id,
    title: mutation.title,
    changeType: mutation.changeType,
    status,
    mutatedPuzzleId,
    comparison,
    interpretation: interpretStatus(status, mutation.title),
    cautions: [
      ...cautions,
      "This is a deterministic heuristic comparison, not proof.",
      "Broken patterns are useful evidence about fragility."
    ]
  };
}

function classifySurvival(comparison: MutationResult["comparison"]): SurvivalStatus {
  const bestRatio = relativeDelta(comparison.bestScoreDelta, comparison.sourceBestScore);
  const avgRatio = relativeDelta(comparison.averageScoreDelta, comparison.sourceAverageScore);
  const diversityRatio = relativeDelta(comparison.distinctFinalStatesDelta, comparison.sourceDistinctFinalStates);
  const scoreDrop = Math.min(bestRatio, avgRatio);

  if (Math.abs(bestRatio) <= 0.1 && Math.abs(avgRatio) <= 0.1 && Math.abs(diversityRatio) <= 0.2) {
    return "survived";
  }
  if (scoreDrop <= -0.3 || Math.abs(diversityRatio) > 0.5) {
    return "broken";
  }
  if (scoreDrop <= -0.1 || Math.abs(diversityRatio) > 0.2) {
    return "weakened";
  }
  return "inconclusive";
}

function relativeDelta(delta: number, source: number): number {
  const denominator = Math.max(1, Math.abs(source));
  return delta / denominator;
}

function interpretStatus(status: SurvivalStatus, title: string): string {
  switch (status) {
    case "survived":
      return `${title} remained similar under this mutation. The pattern candidate is more interesting, but still not proven.`;
    case "weakened":
      return `${title} changed under mutation without fully disappearing. This suggests partial dependence on the mutated condition.`;
    case "broken":
      return `${title} shifted strongly under mutation. That is useful evidence about where the phenomenon may be fragile.`;
    case "inconclusive":
      return `${title} produced changes that are not clean enough to classify. Keep the trace, but avoid interpretation.`;
  }
}

function buildSurvivalReport(plan: MutationPlan, results: MutationResult[]): SurvivalReport {
  const overallStatus = classifyOverall(results);
  return {
    sourceExperimentId: plan.sourceExperimentId,
    sourcePatternName: plan.sourcePattern.name,
    hypothesis: plan.hypothesis,
    planStatus: "run",
    results,
    overallStatus,
    summary: `Pattern Survival for ${plan.sourcePattern.name}: ${overallStatus}. ${results.length} mutation stress tests were evaluated.`,
    cautions: [
      "A pattern candidate becomes more interesting when it survives variation.",
      "A broken pattern is still useful: it tells us where the phenomenon was fragile.",
      "Survival is not proof; it is a cue for the next experiment."
    ]
  };
}

function classifyOverall(results: MutationResult[]): SurvivalStatus {
  if (results.length === 0) {
    return "inconclusive";
  }
  const counts = countStatuses(results);
  if ((counts.survived ?? 0) >= Math.ceil(results.length / 2)) {
    return "survived";
  }
  if ((counts.broken ?? 0) >= Math.ceil(results.length / 2)) {
    return "broken";
  }
  if ((counts.weakened ?? 0) + (counts.broken ?? 0) >= Math.ceil(results.length / 2)) {
    return "weakened";
  }
  return "inconclusive";
}

export function renderMutationResultMarkdown(
  result: MutationResult,
  mutatedPuzzle: SymbolRewritePuzzle,
  deterministicReport: string
): string {
  return `# Mutation Result: ${result.mutationId}

## Source Experiment

${result.sourceExperimentId}

## Mutation

- Title: ${result.title}
- Change type: ${result.changeType}

## Changed Puzzle

- Mutated puzzle ID: ${mutatedPuzzle.id}
- Initial: \`${mutatedPuzzle.initial}\`
- Max steps: ${mutatedPuzzle.maxSteps}
- Rule count: ${mutatedPuzzle.rules.length}

## Comparison

- Best score: ${result.comparison.sourceBestScore} -> ${result.comparison.mutatedBestScore} (${formatDelta(result.comparison.bestScoreDelta)})
- Average score: ${result.comparison.sourceAverageScore.toFixed(2)} -> ${result.comparison.mutatedAverageScore.toFixed(2)} (${formatDelta(result.comparison.averageScoreDelta)})
- Distinct final states: ${result.comparison.sourceDistinctFinalStates} -> ${result.comparison.mutatedDistinctFinalStates} (${formatDelta(result.comparison.distinctFinalStatesDelta)})
- Average final length: ${result.comparison.sourceAverageFinalLength.toFixed(2)} -> ${result.comparison.mutatedAverageFinalLength.toFixed(2)} (${formatDelta(result.comparison.averageFinalLengthDelta)})

## Survival Status

${result.status}

## Interpretation

${result.interpretation}

## Deterministic Mutation Report

${deterministicReport}

## Cautions

${result.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

export function renderSurvivalReportMarkdown(report: SurvivalReport): string {
  return `# Survival Report: ${report.sourceExperimentId}

## Source Pattern Candidate

${report.sourcePatternName}

## Hypothesis

${report.hypothesis}

## Overall Status

${report.overallStatus}

## Results

${report.results.map((result) => `### ${result.mutationId}: ${result.title}

Status: ${result.status}

Comparison:
- Best score delta: ${formatDelta(result.comparison.bestScoreDelta)}
- Average score delta: ${formatDelta(result.comparison.averageScoreDelta)}
- Distinct final states delta: ${formatDelta(result.comparison.distinctFinalStatesDelta)}
- Average final length delta: ${formatDelta(result.comparison.averageFinalLengthDelta)}

Interpretation:
${result.interpretation}`).join("\n\n")}

## Observatory Note

A pattern candidate becomes more interesting when it survives variation.
A broken pattern is still useful: it tells us where the phenomenon was fragile.

## Cautions

${report.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function emptyStats(puzzleId: string, seed: number): ExperimentStats {
  return {
    puzzleId,
    seed,
    runCount: 0,
    bestScore: 0,
    averageScore: 0,
    bestFinalState: "",
    bestSolverName: "none",
    averageFinalLength: 0,
    distinctFinalStates: 0,
    mostCommonFinalStates: [],
    ruleUsageCounts: {},
    patternNotes: [],
    patternObservations: []
  };
}

function findRule(puzzle: SymbolRewritePuzzle, mutation: Mutation) {
  const ruleId = String(mutation.change.ruleId ?? "");
  return puzzle.rules.find((rule) => rule.id === ruleId);
}

function pickAlternateSymbol(puzzle: SymbolRewritePuzzle, current: string): string {
  return puzzle.alphabet.find((symbol) => !current.includes(symbol)) ?? puzzle.alphabet[0] ?? "A";
}

function selectSymbolFromBestState(puzzle: SymbolRewritePuzzle, stats: ExperimentStats): string {
  for (const symbol of stats.bestFinalState) {
    if (puzzle.alphabet.includes(symbol)) {
      return symbol;
    }
  }
  return puzzle.alphabet[0] ?? "A";
}

function mutationSeedOffset(mutationId: string): number {
  return [...mutationId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function countStatuses(results: MutationResult[]): Partial<Record<SurvivalStatus, number>> {
  const counts: Partial<Record<SurvivalStatus, number>> = {};
  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }
  return counts;
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
}
