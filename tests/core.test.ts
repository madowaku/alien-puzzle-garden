import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { generateSymbolRewritePuzzle } from "../src/generators/symbolRewriteGenerator.ts";
import { findApplicableMoves, scoreSymbolRewriteState } from "../src/evaluators/symbolRewriteEvaluator.ts";
import { runRandomSolver } from "../src/solvers/randomSolver.ts";
import { runGreedySolver } from "../src/solvers/greedySolver.ts";
import { runBeamSearchSolver } from "../src/solvers/beamSearchSolver.ts";
import { runExperiment } from "../src/experiments/runExperiment.ts";
import type { SymbolRewritePuzzle } from "../src/types.ts";

const samplePuzzle: SymbolRewritePuzzle = {
  id: "APG-TEST",
  type: "symbol_rewrite",
  alphabet: ["A", "B", "C", "D"],
  initial: "AABCBAD",
  rules: [
    { id: "R1", from: "AA", to: "D" },
    { id: "R2", from: "AB", to: "C" },
    { id: "R3", from: "BC", to: "DA" },
    { id: "R4", from: "D", to: "" }
  ],
  maxSteps: 8,
  objective: {
    primary: "maximize_score",
    secondary: "minimize_length"
  },
  scoreHints: ["more C is good", "avoid repeated D", "shorter strings are better"]
};

test("generator is deterministic and creates applicable symbol rewrite puzzles", () => {
  const first = generateSymbolRewritePuzzle("APG-0001", 1234);
  const second = generateSymbolRewritePuzzle("APG-0001", 1234);

  assert.deepEqual(first, second);
  assert.equal(first.type, "symbol_rewrite");
  assert.deepEqual(first.alphabet, ["A", "B", "C", "D"]);
  assert.ok(first.initial.length >= 8);
  assert.ok(first.initial.length <= 12);
  assert.ok(first.rules.length >= 5);
  assert.ok(first.rules.length <= 8);
  assert.ok(findApplicableMoves(first.initial, first).length > 0);
});

test("applicable moves rewrite each matching rule occurrence", () => {
  const moves = findApplicableMoves("AABC", samplePuzzle);
  const rendered = moves.map((move) => `${move.rule.id}@${move.matchIndex}:${move.after}`);

  assert.deepEqual(rendered, [
    "R1@0:DBC",
    "R2@1:ACC",
    "R3@2:AADA"
  ]);
});

test("score rewards useful compact structure without making empty state best", () => {
  const compactWithTarget = scoreSymbolRewriteState("CCAB", samplePuzzle);
  const repeatedCluster = scoreSymbolRewriteState("DDDD", samplePuzzle);
  const runawayTargetSpam = scoreSymbolRewriteState("CCCCCCCCCCCCCCCCCCCC", samplePuzzle);
  const empty = scoreSymbolRewriteState("", samplePuzzle);

  assert.ok(compactWithTarget > repeatedCluster);
  assert.ok(compactWithTarget > runawayTargetSpam);
  assert.ok(compactWithTarget > empty);
});

test("generator avoids identity rewrites that do not change solver state", () => {
  for (let seed = 100; seed < 120; seed += 1) {
    const puzzle = generateSymbolRewritePuzzle(`APG-${seed}`, seed);
    assert.equal(puzzle.rules.some((rule) => rule.from === rule.to), false);
  }
});

test("solvers return valid runs with reproducible random behavior", () => {
  const randomA = runRandomSolver(samplePuzzle, { runId: "random-1", seed: 77 });
  const randomB = runRandomSolver(samplePuzzle, { runId: "random-1", seed: 77 });
  const greedy = runGreedySolver(samplePuzzle, { runId: "greedy-1" });
  const beam = runBeamSearchSolver(samplePuzzle, { runId: "beam-1", beamWidth: 4 });

  assert.deepEqual(randomA, randomB);
  for (const run of [randomA, greedy, beam]) {
    assert.ok(run.steps.length <= samplePuzzle.maxSteps);
    assert.equal(run.finalState.length, run.finalLength);
    assert.equal(run.score, scoreSymbolRewriteState(run.finalState, samplePuzzle));
    assert.match(run.stoppedReason, /^(max_steps|no_moves)$/);
  }
  assert.ok(beam.score >= greedy.score);
});

test("runExperiment writes experiment files and an index summary", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-test-"));

  try {
    const result = await runExperiment({
      count: 2,
      randomRuns: 3,
      seed: 900,
      outputDir,
      quiet: true
    });

    assert.deepEqual(result.generatedIds, ["APG-0001", "APG-0002"]);

    const report = await readFile(join(outputDir, "APG-0001", "report.md"), "utf8");
    const stats = JSON.parse(await readFile(join(outputDir, "APG-0001", "stats.json"), "utf8"));
    const runs = JSON.parse(await readFile(join(outputDir, "APG-0001", "solver_runs.json"), "utf8"));
    const index = await readFile(join(outputDir, "index.md"), "utf8");

    assert.match(report, /^# Alien Puzzle Report: APG-0001/m);
    assert.match(report, /## Strange Pattern Candidates/);
    assert.equal(stats.runCount, 5);
    assert.equal(stats.seed, 900);
    assert.equal(runs.length, 5);
    assert.match(index, /\| APG-0001 \|/);
    assert.match(index, /\| APG-0002 \|/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
