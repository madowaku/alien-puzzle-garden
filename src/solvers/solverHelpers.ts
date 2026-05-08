import type { ApplicableMove, SolverRun, SolverStep, SymbolRewritePuzzle } from "../types.ts";
import { scoreSymbolRewriteState } from "../evaluators/symbolRewriteEvaluator.ts";

export function buildStep(stepNumber: number, before: string, move: ApplicableMove): SolverStep {
  return {
    step: stepNumber,
    before,
    ruleId: move.rule.id,
    ruleFrom: move.rule.from,
    ruleTo: move.rule.to,
    matchIndex: move.matchIndex,
    after: move.after
  };
}

export function buildRun(
  puzzle: SymbolRewritePuzzle,
  solverName: string,
  runId: string,
  steps: SolverStep[],
  stoppedReason: SolverRun["stoppedReason"]
): SolverRun {
  const finalState = steps.at(-1)?.after ?? puzzle.initial;
  return {
    solverName,
    runId,
    steps,
    finalState,
    score: scoreSymbolRewriteState(finalState, puzzle),
    finalLength: finalState.length,
    stoppedReason
  };
}

export function compareMoves(a: ApplicableMove, b: ApplicableMove, puzzle: SymbolRewritePuzzle): number {
  const scoreDelta = scoreSymbolRewriteState(b.after, puzzle) - scoreSymbolRewriteState(a.after, puzzle);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  if (a.after.length !== b.after.length) {
    return a.after.length - b.after.length;
  }
  const ruleDelta = a.rule.id.localeCompare(b.rule.id);
  if (ruleDelta !== 0) {
    return ruleDelta;
  }
  return a.matchIndex - b.matchIndex;
}
