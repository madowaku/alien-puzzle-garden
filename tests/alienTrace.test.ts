import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildAlienTrace } from "../src/alien/alienTrace.ts";
import { runExperiment } from "../src/experiments/runExperiment.ts";
import type { ExperimentStats, SolverRun, SymbolRewritePuzzle } from "../src/types.ts";

const puzzle: SymbolRewritePuzzle = {
  id: "APG-TRACE",
  type: "symbol_rewrite",
  alphabet: ["A", "B", "C", "D"],
  initial: "ABCD",
  rules: [
    { id: "R1", from: "AB", to: "C" },
    { id: "R2", from: "CD", to: "A" }
  ],
  maxSteps: 3,
  objective: { primary: "maximize_score", secondary: "minimize_length" },
  scoreHints: ["compact states matter"]
};

const runs: SolverRun[] = [
  run("random", "random-001", "CC", 12, ["R1", "R2"]),
  run("greedy", "greedy-001", "AD", 9, ["R2"])
];

const stats: ExperimentStats = {
  puzzleId: puzzle.id,
  seed: 123,
  runCount: runs.length,
  bestScore: 12,
  averageScore: 10.5,
  bestFinalState: "CC",
  bestSolverName: "random",
  averageFinalLength: 2,
  distinctFinalStates: 2,
  mostCommonFinalStates: [{ state: "CC", count: 1 }, { state: "AD", count: 1 }],
  ruleUsageCounts: { R1: 1, R2: 2 },
  patternNotes: ["R2 appears frequently."],
  patternObservations: [{ note: "R2 appears frequently.", confidence: "medium" }]
};

test("alien trace encodes puzzle observations as deterministic AI-native channels", () => {
  const trace = buildAlienTrace(puzzle, runs, stats);
  const again = buildAlienTrace(puzzle, runs, stats);

  assert.deepEqual(trace, again);
  assert.equal(trace.version, "apg-alien-trace/v0.1");
  assert.equal(trace.experimentId, "APG-TRACE");
  assert.equal(trace.humanTranslationPolicy, "translate_only_if_human_interesting");
  assert.ok(trace.symbolMap.A);
  assert.ok(trace.channels.rulePulse.includes("R2:2"));
  assert.ok(trace.channels.finalStateGlyphs.some((item) => item.state === "CC" && item.glyphs === "g2.g2"));
  assert.ok(trace.channels.runGlyphs.some((item) => item.runId === "random-001" && item.tape.includes("R1>R2")));
  assert.match(trace.traceTape, /^apg:APG-TRACE/);
});

test("runExperiment writes alien_trace.json for each experiment", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-alien-trace-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 900, outputDir, quiet: true });
    const trace = JSON.parse(await readFile(join(outputDir, "APG-0001", "alien_trace.json"), "utf8"));

    assert.equal(trace.version, "apg-alien-trace/v0.1");
    assert.equal(trace.experimentId, "APG-0001");
    assert.equal(trace.humanTranslationPolicy, "translate_only_if_human_interesting");
    assert.ok(Array.isArray(trace.channels.runGlyphs));
    assert.ok(trace.traceTape.includes("apg:APG-0001"));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

function run(solverName: string, runId: string, finalState: string, score: number, ruleIds: string[]): SolverRun {
  return {
    solverName,
    runId,
    steps: ruleIds.map((ruleId, index) => ({
      step: index + 1,
      before: puzzle.initial,
      ruleId,
      ruleFrom: ruleId === "R1" ? "AB" : "CD",
      ruleTo: ruleId === "R1" ? "C" : "A",
      matchIndex: 0,
      after: finalState
    })),
    finalState,
    score,
    finalLength: finalState.length,
    stoppedReason: "no_moves"
  };
}
