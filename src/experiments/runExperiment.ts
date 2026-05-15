import { join } from "node:path";
import { buildAlienTrace } from "../alien/alienTrace.ts";
import { generateSymbolRewritePuzzle } from "../generators/symbolRewriteGenerator.ts";
import { runBeamSearchSolver } from "../solvers/beamSearchSolver.ts";
import { runGreedySolver } from "../solvers/greedySolver.ts";
import { runRandomSolver } from "../solvers/randomSolver.ts";
import { buildMarkdownReport, chooseMadowakuName } from "../reports/buildMarkdownReport.ts";
import { writeExperimentFiles, writeExperimentIndex } from "../storage/writeExperimentFiles.ts";
import type {
  ExperimentStats,
  ExperimentSummary,
  PatternConfidence,
  PatternObservation,
  SolverRun
} from "../types.ts";

export type RunExperimentOptions = {
  count?: number;
  randomRuns?: number;
  seed?: number;
  outputDir?: string;
  quiet?: boolean;
};

export type RunExperimentResult = {
  generatedIds: string[];
  summaries: ExperimentSummary[];
};

const DEFAULT_SEED = 424242;

export async function runExperiment(options: RunExperimentOptions = {}): Promise<RunExperimentResult> {
  const count = options.count ?? 5;
  const randomRuns = options.randomRuns ?? 50;
  const baseSeed = options.seed ?? DEFAULT_SEED;
  const outputDir = options.outputDir ?? join(process.cwd(), "experiments");
  const generatedIds: string[] = [];
  const summaries: ExperimentSummary[] = [];

  for (let index = 0; index < count; index += 1) {
    const id = `APG-${String(index + 1).padStart(4, "0")}`;
    const seed = baseSeed + index;
    const puzzle = generateSymbolRewritePuzzle(id, seed);
    const runs = buildRuns(puzzle, randomRuns, seed);
    const stats = computeStats(id, seed, runs);
    const report = buildMarkdownReport(puzzle, stats);
    const alienTrace = buildAlienTrace(puzzle, runs, stats);
    const summary: ExperimentSummary = {
      id,
      seed,
      bestScore: stats.bestScore,
      bestSolverName: stats.bestSolverName,
      distinctFinalStates: stats.distinctFinalStates,
      madowakuName: chooseMadowakuName(stats)
    };

    await writeExperimentFiles(outputDir, puzzle, runs, stats, report, alienTrace);
    generatedIds.push(id);
    summaries.push(summary);
    if (!options.quiet) {
      console.log(`Generated ${id}`);
    }
  }

  await writeExperimentIndex(outputDir, summaries);
  if (!options.quiet) {
    console.log("Done.");
  }

  return { generatedIds, summaries };
}

function buildRuns(
  puzzle: Parameters<typeof runRandomSolver>[0],
  randomRuns: number,
  seed: number
): SolverRun[] {
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

export function computeStats(puzzleId: string, seed: number, runs: SolverRun[]): ExperimentStats {
  const bestRun = [...runs].sort(compareRuns)[0];
  const averageScore = average(runs.map((run) => run.score));
  const averageFinalLength = average(runs.map((run) => run.finalLength));
  const finalStateCounts = countBy(runs.map((run) => run.finalState));
  const ruleUsageCounts = buildRuleUsageCounts(runs);
  const mostCommonFinalStates = Object.entries(finalStateCounts)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
    .slice(0, 5);
  const patternObservations = buildPatternObservations(runs, ruleUsageCounts, mostCommonFinalStates, averageFinalLength);

  return {
    puzzleId,
    seed,
    runCount: runs.length,
    bestScore: bestRun.score,
    averageScore,
    bestFinalState: bestRun.finalState,
    bestSolverName: bestRun.solverName,
    averageFinalLength,
    distinctFinalStates: Object.keys(finalStateCounts).length,
    mostCommonFinalStates,
    ruleUsageCounts,
    patternNotes: patternObservations.map((observation) => observation.note),
    patternObservations
  };
}

function compareRuns(a: SolverRun, b: SolverRun): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.finalLength !== b.finalLength) {
    return a.finalLength - b.finalLength;
  }
  return a.runId.localeCompare(b.runId);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildRuleUsageCounts(runs: SolverRun[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    for (const step of run.steps) {
      counts[step.ruleId] = (counts[step.ruleId] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function buildPatternObservations(
  runs: SolverRun[],
  ruleUsageCounts: Record<string, number>,
  mostCommonFinalStates: Array<{ state: string; count: number }>,
  averageFinalLength: number
): PatternObservation[] {
  const observations: PatternObservation[] = [];
  const topRule = Object.entries(ruleUsageCounts).sort((a, b) => b[1] - a[1])[0];
  const bestRun = [...runs].sort(compareRuns)[0];
  const topFinalState = mostCommonFinalStates[0];
  const randomFinalStates = new Set(runs.filter((run) => run.solverName === "random").map((run) => run.finalState));

  if (topRule && topRule[1] > 0) {
    observations.push({
      note: `Observed runs used ${topRule[0]} most often; it may be a common passage through this rewrite space.`,
      confidence: confidenceFromRatio(topRule[1] / Math.max(1, runs.reduce((sum, run) => sum + run.steps.length, 0)))
    });
  }

  if (bestRun.finalLength < averageFinalLength) {
    observations.push({
      note: "The best run ended with a shorter-than-average final state.",
      confidence: "medium"
    });
  }

  if (topFinalState && topFinalState.count / runs.length >= 0.35) {
    observations.push({
      note: `Many runs converged to the same final state \`${topFinalState.state}\`.`,
      confidence: confidenceFromRatio(topFinalState.count / runs.length)
    });
  }

  if (randomFinalStates.size >= Math.max(3, Math.floor(runs.length / 6))) {
    observations.push({
      note: `Random solver produced ${randomFinalStates.size} distinct final states, suggesting multiple reachable basins.`,
      confidence: "low"
    });
  }

  return observations.slice(0, 4);
}

function confidenceFromRatio(ratio: number): PatternConfidence {
  if (ratio >= 0.6) {
    return "high";
  }
  if (ratio >= 0.3) {
    return "medium";
  }
  return "low";
}
