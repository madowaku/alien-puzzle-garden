import type { ExperimentStats, SolverRun, SymbolRewritePuzzle } from "../types.ts";

export type AlienTrace = {
  version: "apg-alien-trace/v0.1";
  experimentId: string;
  seed: number;
  humanTranslationPolicy: "translate_only_if_human_interesting";
  symbolMap: Record<string, string>;
  traceTape: string;
  channels: {
    rulePulse: string[];
    finalStateGlyphs: Array<{ state: string; glyphs: string; count: number }>;
    runGlyphs: Array<{ runId: string; solverName: string; score: number; tape: string }>;
    scalarPulse: string[];
  };
  cautions: string[];
};

export function buildAlienTrace(
  puzzle: SymbolRewritePuzzle,
  runs: SolverRun[],
  stats: ExperimentStats
): AlienTrace {
  const symbolMap = Object.fromEntries(puzzle.alphabet.map((symbol, index) => [symbol, `g${index}`]));
  const rulePulse = Object.entries(stats.ruleUsageCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([ruleId, count]) => `${ruleId}:${count}`);
  const finalStateGlyphs = stats.mostCommonFinalStates.map((item) => ({
    state: item.state,
    glyphs: encodeState(item.state, symbolMap),
    count: item.count
  }));
  const runGlyphs = [...runs]
    .sort(compareRuns)
    .slice(0, 12)
    .map((run) => ({
      runId: run.runId,
      solverName: run.solverName,
      score: run.score,
      tape: `${run.solverName}:${run.steps.map((step) => step.ruleId).join(">") || "no-move"}:${encodeState(run.finalState, symbolMap)}:${run.score}`
    }));
  const scalarPulse = [
    `best:${stats.bestScore}`,
    `avg:${round(stats.averageScore)}`,
    `len:${round(stats.averageFinalLength)}`,
    `basins:${stats.distinctFinalStates}`,
    `runs:${stats.runCount}`
  ];
  const traceTape = [
    `apg:${puzzle.id}`,
    `seed:${stats.seed}`,
    `init:${encodeState(puzzle.initial, symbolMap)}`,
    `rule:${rulePulse.join(",") || "none"}`,
    `state:${finalStateGlyphs.map((item) => `${item.glyphs}x${item.count}`).join(",") || "none"}`,
    `pulse:${scalarPulse.join(",")}`
  ].join("|");

  return {
    version: "apg-alien-trace/v0.1",
    experimentId: puzzle.id,
    seed: stats.seed,
    humanTranslationPolicy: "translate_only_if_human_interesting",
    symbolMap,
    traceTape,
    channels: {
      rulePulse,
      finalStateGlyphs,
      runGlyphs,
      scalarPulse
    },
    cautions: [
      "This file is an AI-native observation trace, not a human explanation.",
      "Use deterministic reports for fact checks and translate this trace only when it becomes human-interesting."
    ]
  };
}

function encodeState(state: string, symbolMap: Record<string, string>): string {
  if (!state) {
    return "empty";
  }
  return [...state].map((symbol) => symbolMap[symbol] ?? `x${symbol.charCodeAt(0)}`).join(".");
}

function compareRuns(left: SolverRun, right: SolverRun): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.finalLength !== right.finalLength) {
    return left.finalLength - right.finalLength;
  }
  return left.runId.localeCompare(right.runId);
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
