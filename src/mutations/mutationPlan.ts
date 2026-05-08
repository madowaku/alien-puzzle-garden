import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmCriticOutput } from "../critics/criticSchema.ts";
import type { ExperimentStats, SymbolRewritePuzzle } from "../types.ts";
import type { MutationChangeType, MutationPlan } from "./mutationTypes.ts";

type SourcePattern = MutationPlan["sourcePattern"];

export async function buildMutationPlan(experimentDir: string): Promise<MutationPlan> {
  const puzzle = JSON.parse(await readFile(join(experimentDir, "puzzle.json"), "utf8")) as SymbolRewritePuzzle;
  const stats = JSON.parse(await readFile(join(experimentDir, "stats.json"), "utf8")) as ExperimentStats;
  const critic = await readCriticOutput(experimentDir);
  const sourcePattern = selectSourcePattern(critic, stats);
  const suspectedRuleId = selectSuspectedRuleId(puzzle, stats, sourcePattern.name);
  const symbol = selectSymbolFromBestState(puzzle, stats);

  return {
    sourceExperimentId: puzzle.id,
    sourcePattern,
    hypothesis: buildHypothesis(sourcePattern, suspectedRuleId, stats),
    planStatus: "proposed_not_run",
    mutations: buildMutations({ puzzle, stats, suspectedRuleId, symbol }),
    cautions: [
      "This is a stress test, not a proof.",
      "The pattern survives only if it remains visible under variation.",
      "A failed mutation is useful evidence.",
      "Mutation plans are proposed only; this command does not run mutated experiments."
    ]
  };
}

export function renderMutationPlanMarkdown(plan: MutationPlan): string {
  return `# Mutation Plan: ${plan.sourceExperimentId}

## Source Pattern

- Name: ${plan.sourcePattern.name}
- Status: ${plan.sourcePattern.status}
- Confidence: ${plan.sourcePattern.confidence}

## Hypothesis

${plan.hypothesis}

## Proposed Mutations

${plan.mutations.map((mutation) => `### ${mutation.id}: ${mutation.title}

Change:
${mutation.rationale}

\`\`\`json
${JSON.stringify({ changeType: mutation.changeType, change: mutation.change }, null, 2)}
\`\`\`

Expected observation:
${mutation.expectedObservation}

Falsifies if:
${mutation.falsifiesIf}

Risk:
${mutation.risk}`).join("\n\n")}

## Cautions

${plan.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

async function readCriticOutput(experimentDir: string): Promise<LlmCriticOutput | undefined> {
  try {
    const raw = JSON.parse(await readFile(join(experimentDir, "llm_critic_raw.json"), "utf8"));
    if (raw?.parsedOutput) {
      return raw.parsedOutput as LlmCriticOutput;
    }
    if (Array.isArray(raw?.observedPatterns) && Array.isArray(raw?.possibleInvariants)) {
      return raw as LlmCriticOutput;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function selectSourcePattern(critic: LlmCriticOutput | undefined, stats: ExperimentStats): SourcePattern {
  const observed = critic?.observedPatterns
    .slice()
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0];
  if (observed) {
    return {
      name: observed.title,
      status: "pattern_candidate",
      confidence: observed.confidence
    };
  }

  const invariant = critic?.possibleInvariants
    .slice()
    .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence))[0];
  if (invariant) {
    return {
      name: invariant.name,
      status: "invariant_candidate",
      confidence: invariant.confidence
    };
  }

  return {
    name: fallbackPatternName(stats),
    status: "fallback_candidate",
    confidence: "low"
  };
}

function confidenceRank(confidence: "low" | "medium" | "high"): number {
  return { low: 1, medium: 2, high: 3 }[confidence];
}

function fallbackPatternName(stats: ExperimentStats): string {
  const topRule = Object.entries(stats.ruleUsageCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topRule) {
    return `${topRule} Pressure Candidate`;
  }
  if (stats.mostCommonFinalStates[0]) {
    return "Final State Attractor Candidate";
  }
  return "Fallback Pattern Candidate";
}

function selectSuspectedRuleId(puzzle: SymbolRewritePuzzle, stats: ExperimentStats, patternName: string): string {
  const mentionedRule = puzzle.rules.find((rule) => patternName.includes(rule.id));
  if (mentionedRule) {
    return mentionedRule.id;
  }
  return Object.entries(stats.ruleUsageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? puzzle.rules[0]?.id ?? "R1";
}

function selectSymbolFromBestState(puzzle: SymbolRewritePuzzle, stats: ExperimentStats): string {
  for (const symbol of stats.bestFinalState) {
    if (puzzle.alphabet.includes(symbol)) {
      return symbol;
    }
  }
  return puzzle.alphabet[0] ?? "A";
}

function buildHypothesis(sourcePattern: SourcePattern, ruleId: string, stats: ExperimentStats): string {
  if (sourcePattern.status === "fallback_candidate") {
    return `${sourcePattern.name} may be a batch-level pattern suggested by rule usage, final-state diversity, or best final state. It is not confirmed.`;
  }
  return `${sourcePattern.name} may depend on pressure around ${ruleId}; if so, score, convergence, or final-state diversity should change under targeted mutations. Current best score is ${stats.bestScore}.`;
}

function buildMutations(input: {
  puzzle: SymbolRewritePuzzle;
  stats: ExperimentStats;
  suspectedRuleId: string;
  symbol: string;
}): MutationPlan["mutations"] {
  const rule = input.puzzle.rules.find((candidate) => candidate.id === input.suspectedRuleId) ?? input.puzzle.rules[0];
  const alternateOutput = pickAlternateSymbol(input.puzzle, rule?.to ?? input.symbol);
  const mutations = [
    buildMutation("MUT-001", "Remove suspected gate rule", "remove_rule", {
      ruleId: input.suspectedRuleId
    }, `Remove ${input.suspectedRuleId} to see whether the named pattern survives without its suspected gate.`, `If the pattern depends on ${input.suspectedRuleId}, best score should drop or final-state diversity should change.`, `Scores and convergence remain similar after removing ${input.suspectedRuleId}.`, "May make the puzzle too sparse if this rule is the only active passage."),
    buildMutation("MUT-002", "Alter suspected rule output", "alter_rule_output", {
      ruleId: input.suspectedRuleId,
      replaceOutputWith: alternateOutput
    }, `Change the output of ${input.suspectedRuleId} to stress-test whether its produced symbol is acting as a gateway.`, "If the output symbol matters, high-scoring paths should become less common or take different routes.", "High-scoring paths still appear at a similar rate with similar final states.", "A too-strong replacement may create a different pattern rather than testing the original."),
    buildMutation("MUT-003", "Seed best-state symbol into initial string", "seed_initial_symbol", {
      symbol: input.symbol,
      positions: ["prefix", "middle", "suffix"]
    }, `Seed ${input.symbol} into the initial string to test whether the best-state symbol accelerates the pattern.`, "If the symbol acts as a gateway, convergence or score should improve earlier in the run.", "Scores and convergence remain similar regardless of seeded symbol position.", "May make the puzzle easier without explaining the original route."),
    buildMutation("MUT-004", "Change max steps window", "change_max_steps", {
      currentMaxSteps: input.puzzle.maxSteps,
      compare: [Math.max(1, input.puzzle.maxSteps - 3), input.puzzle.maxSteps + 3]
    }, "Vary the observation window to see whether the pattern is early, late, or dependent on long exploration.", "A real batch-level pattern should show a predictable shift when the step window changes.", "The pattern appears or disappears randomly with no relation to max steps.", "Changing max steps can alter many solver dynamics at once."),
    buildMutation("MUT-005", "Increase random run count", "increase_random_runs", {
      currentRunCount: input.stats.runCount,
      suggestedRandomRuns: Math.max(100, input.stats.runCount * 2)
    }, "Increase the random sample size to check whether the pattern survives under more seeds.", "A robust pattern candidate should remain visible under a larger random batch.", "The pattern dissolves into noise when more random seeds are added.", "More runs cost more time and may reveal multiple overlapping patterns.")
  ];
  return mutations.slice(0, 5);
}

function buildMutation(
  id: string,
  title: string,
  changeType: MutationChangeType,
  change: Record<string, unknown>,
  rationale: string,
  expectedObservation: string,
  falsifiesIf: string,
  risk: string
): MutationPlan["mutations"][number] {
  return { id, title, changeType, rationale, change, expectedObservation, falsifiesIf, risk };
}

function pickAlternateSymbol(puzzle: SymbolRewritePuzzle, current: string): string {
  return puzzle.alphabet.find((symbol) => !current.includes(symbol)) ?? puzzle.alphabet[0] ?? "A";
}
