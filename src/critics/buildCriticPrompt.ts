import type { ExperimentStats, SolverRun, SymbolRewritePuzzle } from "../types.ts";
import type { CriticTone } from "./criticSchema.ts";

export type CriticInput = {
  puzzle: SymbolRewritePuzzle;
  stats: ExperimentStats;
  topRuns: SolverRun[];
  lowRuns: SolverRun[];
  representativeRuns: SolverRun[];
  deterministicPatternNotes: string[];
  deterministicReportExcerpt: string;
};

export type CriticPrompt = {
  system: string;
  user: string;
};

export type CriticPromptOptions = {
  tone?: CriticTone;
};

export function buildCriticInput(
  puzzle: SymbolRewritePuzzle,
  solverRuns: SolverRun[],
  stats: ExperimentStats,
  deterministicReport = ""
): CriticInput {
  const sorted = [...solverRuns].sort(compareRuns);
  const representativeRuns = selectRepresentativeRuns(solverRuns);

  return {
    puzzle,
    stats,
    topRuns: sorted.slice(0, 5),
    lowRuns: sorted.slice(-5).reverse(),
    representativeRuns,
    deterministicPatternNotes: stats.patternNotes,
    deterministicReportExcerpt: deterministicReport.slice(0, 4000)
  };
}

export function buildCriticPrompt(input: CriticInput, options: CriticPromptOptions = {}): CriticPrompt {
  const tone = options.tone ?? "observatory";
  return {
    system: [
      "You are the observer of the Strange Pattern Observatory.",
      "You are reading traces from an AI-only puzzle garden.",
      "The puzzle is not designed for direct human play.",
      "Your job is not to prove a theorem.",
      "Your job is to identify pattern candidates that are worth naming and testing.",
      "The puzzle is not necessarily human-readable.",
      "You must not claim proof.",
      "You must not claim novelty.",
      "You must not claim intelligence or discovery.",
      "You must separate observed evidence from speculation.",
      "Use this ladder: 1. Observed: directly supported by the provided stats or runs. 2. Suggested: plausible from the traces but not confirmed. 3. Testable: can be checked by a follow-up experiment. 4. Do not state: proof, novelty, general theorem, or real mathematical significance.",
      "Prefer phrases like pattern candidate, possible bottleneck, naming-worthy, mutation test, survives under variation, observed in this batch, and not yet an invariant.",
      "Explicitly mention when evidence is weak.",
      "You should look for convergence, attractors, compression, dead clusters, early gates, rewrite bottlenecks, and failure modes.",
      "You should propose next experiments that can be tested by changing the initial string, rule set, max steps, scoring weights, solver mix, or random seed count.",
      toneModifier(tone)
    ].join(" "),
    user: JSON.stringify({
      task: "Produce JSON critic output for this Alien Puzzle Garden experiment.",
      tone,
      criticInput: input
    }, null, 2)
  };
}

function toneModifier(tone: CriticTone): string {
  switch (tone) {
    case "observatory":
      return "Act as an observatory log: cautious, precise, naming-oriented, and experiment-driven.";
    case "mathematician":
      return "Act as the mathematician: emphasize formal structure, possible invariants, counterexamples, and falsification tests while staying cautious.";
    case "skeptic":
      return "Act as the skeptic: stress weak evidence, alternative explanations, and what would disconfirm each pattern candidate.";
    case "poet":
      return "Act as the poet: keep the evidence precise, but make metaphors and name candidates more vivid.";
  }
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

function selectRepresentativeRuns(runs: SolverRun[]): SolverRun[] {
  const selected: SolverRun[] = [];
  const seenFinalStates = new Set<string>();
  for (const run of [...runs].sort(compareRuns)) {
    if (seenFinalStates.has(run.finalState)) {
      continue;
    }
    seenFinalStates.add(run.finalState);
    selected.push(run);
    if (selected.length >= 5) {
      break;
    }
  }
  return selected;
}
