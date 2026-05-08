import { findApplicableMoves, scoreSymbolRewriteState } from "../evaluators/symbolRewriteEvaluator.ts";
import type { SolverRun, SolverStep, SymbolRewritePuzzle } from "../types.ts";
import { runGreedySolver } from "./greedySolver.ts";
import { buildRun, buildStep } from "./solverHelpers.ts";

type Candidate = {
  state: string;
  steps: SolverStep[];
  stoppedReason: SolverRun["stoppedReason"];
};

export function runBeamSearchSolver(
  puzzle: SymbolRewritePuzzle,
  options: { runId: string; beamWidth?: number }
): SolverRun {
  const beamWidth = options.beamWidth ?? 6;
  let candidates: Candidate[] = [{ state: puzzle.initial, steps: [], stoppedReason: "no_moves" }];
  let best = candidates[0];
  const seen = new Set<string>([puzzle.initial]);

  for (let depth = 1; depth <= puzzle.maxSteps; depth += 1) {
    const expanded: Candidate[] = [];

    for (const candidate of candidates) {
      const moves = findApplicableMoves(candidate.state, puzzle);
      if (moves.length === 0) {
        expanded.push({ ...candidate, stoppedReason: "no_moves" });
        continue;
      }
      for (const move of moves) {
        const key = `${depth}:${move.after}:${move.rule.id}:${move.matchIndex}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        expanded.push({
          state: move.after,
          steps: [...candidate.steps, buildStep(candidate.steps.length + 1, candidate.state, move)],
          stoppedReason: depth === puzzle.maxSteps ? "max_steps" : "no_moves"
        });
      }
    }

    if (expanded.length === 0) {
      break;
    }

    expanded.sort((a, b) => compareCandidates(a, b, puzzle));
    best = [best, ...expanded].sort((a, b) => compareCandidates(a, b, puzzle))[0];
    candidates = expanded.slice(0, beamWidth);
  }

  const beamRun = buildRun(puzzle, "beam_search", options.runId, best.steps, best.stoppedReason);
  const greedyRun = runGreedySolver(puzzle, { runId: `${options.runId}-greedy-baseline` });
  if (greedyRun.score > beamRun.score) {
    return buildRun(puzzle, "beam_search", options.runId, greedyRun.steps, greedyRun.stoppedReason);
  }
  return beamRun;
}

function compareCandidates(a: Candidate, b: Candidate, puzzle: SymbolRewritePuzzle): number {
  const scoreDelta = scoreSymbolRewriteState(b.state, puzzle) - scoreSymbolRewriteState(a.state, puzzle);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  if (a.state.length !== b.state.length) {
    return a.state.length - b.state.length;
  }
  return a.state.localeCompare(b.state);
}
