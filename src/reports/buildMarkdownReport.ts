import type { ExperimentStats, SymbolRewritePuzzle } from "../types.ts";

const MATH_FLAVORS = [
  "string rewriting systems",
  "reachability",
  "compression",
  "local search",
  "graph of states",
  "convergence / attractors"
];

const NAME_CANDIDATES = [
  "Early Fold Gate",
  "Compression Core",
  "Repeating Shell",
  "Dead Cluster",
  "Fold Point",
  "Symbol Tide",
  "Echo Knot"
];

export function buildMarkdownReport(puzzle: SymbolRewritePuzzle, stats: ExperimentStats): string {
  const name = chooseMadowakuName(stats);
  const observations = stats.patternObservations.length > 0
    ? stats.patternObservations.map((item) => `- (${item.confidence}) ${item.note}`).join("\n")
    : "- (low) No strong pattern candidate appeared in this small run.";

  return `# Alien Puzzle Report: ${puzzle.id}

## Type

Symbol Rewrite Puzzle

## Human Readability

Low. This puzzle is designed for solver behavior, not direct human play.

## Seed

${stats.seed}

## Initial State

\`${puzzle.initial}\`

## Rule Set

${puzzle.rules.map((rule) => `- ${rule.id}: \`${rule.from}\` -> \`${rule.to}\``).join("\n")}

## Solver Summary

${stats.runCount} solver runs were executed.

- Best score: ${stats.bestScore}
- Average score: ${stats.averageScore.toFixed(2)}
- Best final state: \`${stats.bestFinalState}\`
- Best solver: ${stats.bestSolverName}
- Average final length: ${stats.averageFinalLength.toFixed(2)}
- Distinct final states: ${stats.distinctFinalStates}

## Strange Pattern Candidates

${observations}

## Possible Math Flavor

${MATH_FLAVORS.join(" / ")}

## Human Metaphor

${buildHumanMetaphor(name, stats)}

## Next Experiment

${buildNextExperiment(stats)}

## madowaku Name Candidate

${name}
`;
}

export function chooseMadowakuName(stats: ExperimentStats): string {
  const index = Math.abs(stats.bestScore + stats.distinctFinalStates + stats.seed) % NAME_CANDIDATES.length;
  return NAME_CANDIDATES[index];
}

function buildHumanMetaphor(name: string, stats: ExperimentStats): string {
  if (stats.distinctFinalStates <= 3) {
    return `${name}: many paths folding toward a small hidden chamber.`;
  }
  if (stats.averageFinalLength < 5) {
    return `${name}: a dream-language compressing itself into a hard bright syllable.`;
  }
  return `${name}: symbols drifting like a tide until one pattern briefly catches light.`;
}

function buildNextExperiment(stats: ExperimentStats): string {
  const topRule = Object.entries(stats.ruleUsageCounts).sort((a, b) => b[1] - a[1])[0];
  if (topRule && topRule[1] > 0) {
    return `Mutate rule ${topRule[0]} slightly and test whether the same solver bias remains.`;
  }
  return "Increase the rule count by one and test whether more routes create clearer convergence.";
}
