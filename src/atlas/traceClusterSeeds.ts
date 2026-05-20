import type { TraceAtlas, TraceAtlasEntry, TraceRuleFamily } from "./traceAtlas.ts";
import type { ResearchVocabularyHints } from "../research/researchVocabularyHints.ts";

export type TraceClusterBasis =
  | "dominant_rule_family"
  | "translation_reason"
  | "human_interest_band"
  | "decision"
  | "vocabulary_hint";

export type TraceClusterTranslationPolicy =
  | "candidate_for_future_translation"
  | "keep_ai_native_for_now";

export type TraceClusterSeed = {
  clusterId: string;
  basis: TraceClusterBasis[];
  traceCount: number;
  experiments: string[];
  dominantRuleId: string;
  humanInterestBand: "high" | "medium" | "low";
  decision: "translate" | "do_not_translate" | "mixed";
  localSignals: string[];
  vocabularyHints: string[];
  translationPolicy: TraceClusterTranslationPolicy;
  cautions: string[];
};

export type TraceClusterSeeds = {
  version: "apg-trace-cluster-seeds/v0.1";
  generatedAt: string;
  seedCount: number;
  seeds: TraceClusterSeed[];
  cautions: string[];
};

export type TraceClusterSeedInput = {
  traceAtlas: TraceAtlas;
  researchVocabularyHints?: ResearchVocabularyHints;
};

const CAUTIONS = [
  "Cluster seed only; not a proven pattern.",
  "Vocabulary hints are speculative.",
  "Trace grouping is deterministic and local, not full clustering."
];

export function buildTraceClusterSeeds(input: TraceClusterSeedInput): TraceClusterSeeds {
  const entries = [...input.traceAtlas.translationCandidates, ...input.traceAtlas.quietTraces];
  const seeds = input.traceAtlas.ruleFamilies.map((family, index) => {
    const familyEntries = entries.filter((entry) => entry.dominantRuleId === family.dominantRuleId);
    return buildSeed(family, familyEntries, input.traceAtlas.reasonCounts, input.researchVocabularyHints, index);
  });

  return {
    version: "apg-trace-cluster-seeds/v0.1",
    generatedAt: `deterministic:${seeds.length}`,
    seedCount: seeds.length,
    seeds,
    cautions: CAUTIONS
  };
}

export function renderTraceClusterSeedsMarkdown(clusterSeeds: TraceClusterSeeds): string {
  return `# Trace Cluster Seeds

## Summary

- Seed count: ${clusterSeeds.seedCount}

## Seeds

${clusterSeeds.seeds.map(renderSeed).join("\n\n") || "No trace cluster seeds observed."}

## Cautions

${clusterSeeds.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function buildSeed(
  family: TraceRuleFamily,
  familyEntries: TraceAtlasEntry[],
  reasonCounts: Record<string, number>,
  researchVocabularyHints: ResearchVocabularyHints | undefined,
  index: number
): TraceClusterSeed {
  const vocabularyHints = vocabularyForRule(family.dominantRuleId, researchVocabularyHints);
  const decision = decisionFor(familyEntries);
  const humanInterestBand = bandFor(family.averageHumanInterestScore);
  return {
    clusterId: `TCS-${String(index + 1).padStart(3, "0")}`,
    basis: ["dominant_rule_family", "translation_reason", "human_interest_band", "decision", "vocabulary_hint"],
    traceCount: family.count,
    experiments: family.experimentIds,
    dominantRuleId: family.dominantRuleId,
    humanInterestBand,
    decision,
    localSignals: localSignalsFor(familyEntries, reasonCounts),
    vocabularyHints,
    translationPolicy: decision === "translate" || humanInterestBand === "high" ? "candidate_for_future_translation" : "keep_ai_native_for_now",
    cautions: CAUTIONS
  };
}

function renderSeed(seed: TraceClusterSeed): string {
  return `### ${seed.clusterId}

- Dominant rule family: ${seed.dominantRuleId}
- Basis: ${seed.basis.join(", ")}
- Trace count: ${seed.traceCount}
- Experiments: ${seed.experiments.join(", ") || "none"}
- Human interest band: ${seed.humanInterestBand}
- Decision: ${seed.decision}
- Translation policy: ${seed.translationPolicy}

Local signals:

${seed.localSignals.map((signal) => `- ${signal}`).join("\n") || "- none"}

Vocabulary hints:

${seed.vocabularyHints.map((hint) => `- ${hint}`).join("\n") || "- none"}

Cautions:

${seed.cautions.map((caution) => `- ${caution}`).join("\n")}`;
}

function localSignalsFor(entries: TraceAtlasEntry[], reasonCounts: Record<string, number>): string[] {
  const entryReasons = entries.flatMap((entry) => entry.reasons);
  const reasons = entryReasons.length > 0 ? entryReasons : Object.keys(reasonCounts);
  return unique(reasons).slice(0, 5);
}

function vocabularyForRule(dominantRuleId: string, hints: ResearchVocabularyHints | undefined): string[] {
  const family = hints?.traceFamilyHints.find((item) => item.dominantRuleId === dominantRuleId);
  return unique((family?.possibleVocabularyHints ?? []).map((hint) => hint.term)).slice(0, 5);
}

function decisionFor(entries: TraceAtlasEntry[]): TraceClusterSeed["decision"] {
  const decisions = unique(entries.map((entry) => entry.decision));
  if (decisions.length === 1 && decisions[0]) {
    return decisions[0] === "translate" ? "translate" : "do_not_translate";
  }
  return "mixed";
}

function bandFor(score: number): TraceClusterSeed["humanInterestBand"] {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
