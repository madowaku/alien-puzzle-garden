import type { AlienTrace } from "../alien/alienTrace.ts";

export type TranslationDecision = "translate" | "do_not_translate";

export type TranslationGate = {
  version: "apg-translation-gate/v0.1";
  experimentId: string;
  sourceTrace: "alien_trace.json";
  decision: TranslationDecision;
  humanInterestScore: number;
  translationMode: "short_observatory_note" | "none";
  reasons: string[];
  suggestedNote: string;
  cautions: string[];
};

const TRANSLATION_THRESHOLD = 0.65;

export function buildTranslationGate(trace: AlienTrace): TranslationGate {
  const scoreContrast = getScalar(trace, "best") - getScalar(trace, "avg");
  const basinCount = getScalar(trace, "basins");
  const ruleConcentration = computeRuleConcentration(trace.channels.rulePulse);
  const finalStateCount = trace.channels.finalStateGlyphs.length;
  const reasons: string[] = [];
  let score = 0;

  if (scoreContrast >= 30) {
    score += 0.3;
    reasons.push("strong score contrast");
  } else if (scoreContrast >= 10) {
    score += 0.15;
    reasons.push("moderate score contrast");
  } else {
    reasons.push("low score contrast");
  }

  if (ruleConcentration >= 0.75 && trace.channels.rulePulse.length > 1) {
    score += 0.25;
    reasons.push("high rule pulse concentration");
  } else if (ruleConcentration >= 0.5) {
    score += 0.1;
    reasons.push("moderate rule pulse concentration");
  }

  if (basinCount >= 5 || finalStateCount >= 4) {
    score += 0.25;
    reasons.push("multiple distinct basins");
  } else if (basinCount <= 1 && finalStateCount <= 1) {
    reasons.push("low basin diversity");
  }

  if (trace.traceTape.length >= 160) {
    score += 0.1;
    reasons.push("dense trace tape");
  }
  if (trace.channels.runGlyphs.length >= 6) {
    score += 0.1;
    reasons.push("many run glyphs available");
  }

  const humanInterestScore = clamp(round(score));
  const decision: TranslationDecision = humanInterestScore >= TRANSLATION_THRESHOLD ? "translate" : "do_not_translate";

  return {
    version: "apg-translation-gate/v0.1",
    experimentId: trace.experimentId,
    sourceTrace: "alien_trace.json",
    decision,
    humanInterestScore,
    translationMode: decision === "translate" ? "short_observatory_note" : "none",
    reasons,
    suggestedNote: buildSuggestedNote(trace, decision, humanInterestScore, reasons),
    cautions: [
      "This gate is a deterministic human-interest filter, not an interpretation engine.",
      "A translate decision means the trace may be worth explaining, not that it is important.",
      "A do_not_translate decision preserves the AI-native trace without forcing human readability."
    ]
  };
}

export function renderTranslationNoteMarkdown(gate: TranslationGate): string {
  return `# Translation Note: ${gate.experimentId}

## Decision

${gate.decision}

Human Interest Score: ${gate.humanInterestScore.toFixed(2)}

## Why This Trace Passed The Gate

${gate.reasons.map((reason) => `- ${reason}`).join("\n")}

## Short Observatory Note

${gate.suggestedNote}

## Cautions

${gate.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function buildSuggestedNote(trace: AlienTrace, decision: TranslationDecision, score: number, reasons: string[]): string {
  if (decision === "do_not_translate") {
    return `The trace for ${trace.experimentId} remains AI-native for now. Score ${score.toFixed(2)} did not cross the translation gate.`;
  }
  const reasonText = reasons.slice(0, 3).join(", ");
  return `${trace.experimentId} produced an AI-native trace with ${reasonText}. This may be worth a short human-facing observatory note, while preserving alien_trace.json as the source artifact.`;
}

function getScalar(trace: AlienTrace, key: string): number {
  const item = trace.channels.scalarPulse.find((pulse) => pulse.startsWith(`${key}:`));
  const parsed = Number.parseFloat(item?.split(":")[1] ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeRuleConcentration(rulePulse: string[]): number {
  const counts = rulePulse.map((item) => Number.parseFloat(item.split(":")[1] ?? "0")).filter(Number.isFinite);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0 || counts.length === 0) {
    return 0;
  }
  return Math.max(...counts) / total;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
