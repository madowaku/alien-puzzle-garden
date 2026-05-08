import { findApplicableMoves } from "../evaluators/symbolRewriteEvaluator.ts";
import type { SolverRun, SolverStep, SymbolRewritePuzzle } from "../types.ts";
import { buildRun, buildStep, compareMoves } from "./solverHelpers.ts";

export function runGreedySolver(puzzle: SymbolRewritePuzzle, options: { runId: string }): SolverRun {
  const steps: SolverStep[] = [];
  let state = puzzle.initial;

  for (let stepNumber = 1; stepNumber <= puzzle.maxSteps; stepNumber += 1) {
    const moves = findApplicableMoves(state, puzzle).sort((a, b) => compareMoves(a, b, puzzle));
    const move = moves[0];
    if (!move) {
      return buildRun(puzzle, "greedy", options.runId, steps, "no_moves");
    }
    steps.push(buildStep(stepNumber, state, move));
    state = move.after;
  }

  return buildRun(puzzle, "greedy", options.runId, steps, "max_steps");
}
