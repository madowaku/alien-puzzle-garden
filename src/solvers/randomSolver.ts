import { findApplicableMoves } from "../evaluators/symbolRewriteEvaluator.ts";
import type { SolverRun, SolverStep, SymbolRewritePuzzle } from "../types.ts";
import { SeededRandom } from "../utils/random.ts";
import { buildRun, buildStep } from "./solverHelpers.ts";

export function runRandomSolver(
  puzzle: SymbolRewritePuzzle,
  options: { runId: string; seed?: number }
): SolverRun {
  const rng = new SeededRandom(options.seed ?? 1);
  const steps: SolverStep[] = [];
  let state = puzzle.initial;

  for (let stepNumber = 1; stepNumber <= puzzle.maxSteps; stepNumber += 1) {
    const moves = findApplicableMoves(state, puzzle);
    if (moves.length === 0) {
      return buildRun(puzzle, "random", options.runId, steps, "no_moves");
    }
    const move = rng.choice(moves);
    steps.push(buildStep(stepNumber, state, move));
    state = move.after;
  }

  return buildRun(puzzle, "random", options.runId, steps, "max_steps");
}
