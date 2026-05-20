import type { TraceAtlas } from "../atlas/traceAtlas.ts";
import type { ResearchSignal, ResearchSignalIndex } from "./researchSignals.ts";

export type ResearchVocabularyHintStatus = "translation_vocabulary_only";

export type ResearchVocabularyHint = {
  term: string;
  sourceSignalId: string;
  sourceTitle: string;
  confidence: ResearchSignal["confidence"];
  status: ResearchVocabularyHintStatus;
  reason: string;
};

export type ResearchTraceFamilyHint = {
  dominantRuleId: string;
  experimentIds: string[];
  localTraceEvidence: {
    dominantRulePulse: string;
    recurringReasons: string[];
    averageHumanInterestScore: number;
  };
  possibleVocabularyHints: ResearchVocabularyHint[];
  cautions: string[];
};

export type ResearchVocabularyHints = {
  version: "apg-research-vocabulary-hints/v0.1";
  generatedAt: string;
  traceFamilyHints: ResearchTraceFamilyHint[];
  aiCreoleHandoff: string;
  cautions: string[];
};

export type ResearchVocabularyHintsInput = {
  traceAtlas: TraceAtlas;
  researchSignalIndex: ResearchSignalIndex;
};

const CAUTIONS = [
  "These hints are not evidence.",
  "These hints are not proof.",
  "These hints are not a matched theory.",
  "These hints are translation vocabulary only."
];

export function buildResearchVocabularyHints(input: ResearchVocabularyHintsInput): ResearchVocabularyHints {
  const reasonCounts = input.traceAtlas.reasonCounts;
  const traceFamilyHints = input.traceAtlas.ruleFamilies.map((family) => {
    const recurringReasons = topReasons(reasonCounts, 3);
    const familyText = `${family.dominantRuleId} ${recurringReasons.join(" ")}`.toLowerCase();
    return {
      dominantRuleId: family.dominantRuleId,
      experimentIds: family.experimentIds,
      localTraceEvidence: {
        dominantRulePulse: `${family.dominantRuleId} compression-like`,
        recurringReasons,
        averageHumanInterestScore: family.averageHumanInterestScore
      },
      possibleVocabularyHints: selectVocabularyHints(familyText, input.researchSignalIndex.signals),
      cautions: CAUTIONS
    };
  });

  return {
    version: "apg-research-vocabulary-hints/v0.1",
    generatedAt: `deterministic:${traceFamilyHints.length}:${input.researchSignalIndex.signalCount}`,
    traceFamilyHints,
    aiCreoleHandoff: buildAiCreoleHandoff(),
    cautions: CAUTIONS
  };
}

export function renderResearchVocabularyHintsMarkdown(hints: ResearchVocabularyHints): string {
  return `# Research Vocabulary Hints

## Summary

- Trace families: ${hints.traceFamilyHints.length}

## Trace Family Hints

${hints.traceFamilyHints.map(renderFamily).join("\n\n") || "No trace families observed."}

## AI Creole Handoff

\`\`\`txt
${hints.aiCreoleHandoff}
\`\`\`

## Cautions

${hints.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function renderFamily(family: ResearchTraceFamilyHint): string {
  return `### Trace family: ${family.dominantRuleId}

Local trace evidence:

- Dominant rule pulse: ${family.localTraceEvidence.dominantRulePulse}
- Recurring reasons: ${family.localTraceEvidence.recurringReasons.join(", ") || "none"}
- Average human interest score: ${family.localTraceEvidence.averageHumanInterestScore.toFixed(2)}
- Experiments: ${family.experimentIds.join(", ") || "none"}

Possible vocabulary hints:

${family.possibleVocabularyHints.map((hint) => `- ${hint.term} (${hint.confidence}, translation vocabulary only)
  - Source: ${hint.sourceTitle}
  - Reason: ${hint.reason}`).join("\n") || "- none"}

Local trace evidence and external vocabulary are kept separate. These hints are not evidence, not proof, and not matched theory.`;
}

function selectVocabularyHints(familyText: string, signals: ResearchSignal[]): ResearchVocabularyHint[] {
  const hints = signals
    .map((signal) => ({ signal, score: scoreSignal(signal, familyText) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.signal.id.localeCompare(right.signal.id))
    .slice(0, 4)
    .flatMap(({ signal }) => signal.topics.slice(0, 2).map((term) => ({
      term,
      sourceSignalId: signal.id,
      sourceTitle: signal.title,
      confidence: signal.confidence,
      status: "translation_vocabulary_only" as const,
      reason: `Speculative vocabulary from ${signal.source}; selected because its APG connections overlap with local trace words.`
    })));
  return uniqueByTerm(hints);
}

function scoreSignal(signal: ResearchSignal, familyText: string): number {
  const text = `${signal.topics.join(" ")} ${signal.apgConnections.join(" ")}`.toLowerCase();
  let score = 0;
  for (const token of ["trace", "atlas", "basin", "survival", "rewrite", "symbol", "graph", "pulse", "dynamics"]) {
    if (familyText.includes(token) || text.includes(token)) {
      score += text.includes(token) ? 1 : 0;
    }
  }
  if (signal.confidence === "medium") {
    score += 0.25;
  }
  if (signal.confidence === "high") {
    score += 0.5;
  }
  return score;
}

function topReasons(reasonCounts: Record<string, number>, limit: number): string[] {
  return Object.entries(reasonCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([reason]) => reason);
}

function uniqueByTerm(hints: ResearchVocabularyHint[]): ResearchVocabularyHint[] {
  const seen = new Set<string>();
  const unique: ResearchVocabularyHint[] = [];
  for (const hint of hints) {
    const key = hint.term.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(hint);
  }
  return unique;
}

function buildAiCreoleHandoff(): string {
  return [
    "ROLE: VocabularyScout",
    "MODE: cautious",
    "TASK: map_trace_to_possible_terms",
    "GOAL: suggest translation vocabulary only",
    "KEEP: local evidence separate from external vocabulary",
    "NO: claim equivalence or novelty",
    "OUT: research_vocabulary_hints.json",
    "CHECK: all hints are marked speculative",
    "NEXT: translation_note or trace_cluster_seed"
  ].join("\n");
}
