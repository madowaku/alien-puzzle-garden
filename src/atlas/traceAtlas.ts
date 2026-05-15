import type { AlienTrace } from "../alien/alienTrace.ts";
import { buildTranslationGate, type TranslationGate } from "../translation/translationGate.ts";

export type TraceAtlasInput = {
  trace: AlienTrace;
  gate?: TranslationGate;
};

export type TraceAtlasEntry = {
  experimentId: string;
  humanInterestScore: number;
  decision: TranslationGate["decision"];
  dominantRuleId: string;
  basinCount: number;
  reasons: string[];
};

export type TraceRuleFamily = {
  dominantRuleId: string;
  experimentIds: string[];
  count: number;
  averageHumanInterestScore: number;
};

export type TraceAtlas = {
  version: "apg-trace-atlas/v0.1";
  generatedAt: string;
  experimentCount: number;
  translationDecisionCounts: Record<TranslationGate["decision"], number>;
  reasonCounts: Record<string, number>;
  ruleFamilies: TraceRuleFamily[];
  translationCandidates: TraceAtlasEntry[];
  quietTraces: TraceAtlasEntry[];
  cautions: string[];
};

export function buildTraceAtlas(inputs: TraceAtlasInput[]): TraceAtlas {
  const entries = inputs.map((input) => toEntry(input.trace, input.gate ?? buildTranslationGate(input.trace)));
  const missingGateCount = inputs.filter((input) => !input.gate).length;

  return {
    version: "apg-trace-atlas/v0.1",
    generatedAt: `deterministic:${entries.length}`,
    experimentCount: entries.length,
    translationDecisionCounts: countDecisions(entries),
    reasonCounts: countReasons(entries),
    ruleFamilies: buildRuleFamilies(entries),
    translationCandidates: entries
      .filter((entry) => entry.decision === "translate")
      .sort(compareEntries)
      .slice(0, 12),
    quietTraces: entries
      .filter((entry) => entry.decision === "do_not_translate")
      .sort((left, right) => left.humanInterestScore - right.humanInterestScore || left.experimentId.localeCompare(right.experimentId))
      .slice(0, 12),
    cautions: [
      "This atlas does not prove a pattern; it only groups local AI-native trace signals.",
      "Translation candidates are human-interest candidates, not mathematical discoveries.",
      ...(missingGateCount > 0 ? [`${missingGateCount} trace(s) had missing translation gates and were scored with the deterministic fallback.`] : [])
    ]
  };
}

export function renderTraceAtlasMarkdown(atlas: TraceAtlas): string {
  return `# Trace Atlas

## Summary

- Experiments: ${atlas.experimentCount}
- Translate: ${atlas.translationDecisionCounts.translate}
- Do not translate: ${atlas.translationDecisionCounts.do_not_translate}

## Reason Counts

${formatRecord(atlas.reasonCounts)}

## Rule Families

${atlas.ruleFamilies.map((family) => `### ${family.dominantRuleId}

- Experiments: ${family.experimentIds.join(", ")}
- Count: ${family.count}
- Average human interest score: ${family.averageHumanInterestScore.toFixed(2)}`).join("\n\n") || "No rule families observed."}

## Translation candidates

${atlas.translationCandidates.map(formatEntry).join("\n\n") || "No traces crossed the translation gate."}

## Quiet AI-Native Traces

${atlas.quietTraces.map(formatEntry).join("\n\n") || "No quiet traces observed."}

## Observatory Note

This atlas does not prove a pattern.
It only groups local trace tapes so future APG agents can decide what to cluster, translate, mutate, or ignore.

## Cautions

${atlas.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function toEntry(trace: AlienTrace, gate: TranslationGate): TraceAtlasEntry {
  return {
    experimentId: trace.experimentId,
    humanInterestScore: gate.humanInterestScore,
    decision: gate.decision,
    dominantRuleId: dominantRule(trace.channels.rulePulse),
    basinCount: getScalar(trace, "basins"),
    reasons: gate.reasons
  };
}

function countDecisions(entries: TraceAtlasEntry[]): Record<TranslationGate["decision"], number> {
  return entries.reduce((counts, entry) => {
    counts[entry.decision] += 1;
    return counts;
  }, { translate: 0, do_not_translate: 0 });
}

function countReasons(entries: TraceAtlasEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    for (const reason of entry.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function buildRuleFamilies(entries: TraceAtlasEntry[]): TraceRuleFamily[] {
  const groups = new Map<string, TraceAtlasEntry[]>();
  for (const entry of entries) {
    const key = entry.dominantRuleId;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([dominantRuleId, familyEntries]) => ({
      dominantRuleId,
      experimentIds: familyEntries.map((entry) => entry.experimentId).sort(),
      count: familyEntries.length,
      averageHumanInterestScore: round(average(familyEntries.map((entry) => entry.humanInterestScore)))
    }))
    .sort((left, right) => right.count - left.count || right.averageHumanInterestScore - left.averageHumanInterestScore || left.dominantRuleId.localeCompare(right.dominantRuleId));
}

function dominantRule(rulePulse: string[]): string {
  const [top] = [...rulePulse].sort((left, right) => {
    const leftCount = Number.parseFloat(left.split(":")[1] ?? "0");
    const rightCount = Number.parseFloat(right.split(":")[1] ?? "0");
    return rightCount - leftCount || left.localeCompare(right);
  });
  return top?.split(":")[0] ?? "none";
}

function getScalar(trace: AlienTrace, key: string): number {
  const item = trace.channels.scalarPulse.find((pulse) => pulse.startsWith(`${key}:`));
  const parsed = Number.parseFloat(item?.split(":")[1] ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareEntries(left: TraceAtlasEntry, right: TraceAtlasEntry): number {
  return right.humanInterestScore - left.humanInterestScore || left.experimentId.localeCompare(right.experimentId);
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatRecord(record: Record<string, number>): string {
  const rows = Object.entries(record).map(([key, value]) => `- ${key}: ${value}`);
  return rows.length > 0 ? rows.join("\n") : "- none observed";
}

function formatEntry(entry: TraceAtlasEntry): string {
  return `### ${entry.experimentId}

- Decision: ${entry.decision}
- Human interest score: ${entry.humanInterestScore.toFixed(2)}
- Dominant rule: ${entry.dominantRuleId}
- Basins: ${entry.basinCount}
- Reasons: ${entry.reasons.join(", ") || "none"}`;
}
