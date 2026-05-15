import { readFile } from "node:fs/promises";

export type ResearchSignalConfidence = "low" | "medium" | "high";

export type ResearchSignal = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  topics: string[];
  apgConnections: string[];
  confidence: ResearchSignalConfidence;
  summary: string;
};

export type ResearchSignalRecommendation = {
  title: string;
  nextAction: "inspect_for_apg_relevance" | "map_to_trace_atlas" | "save_for_later";
  reason: string;
};

export type ResearchSignalIndex = {
  version: "apg-research-signal-index/v0.1";
  generatedAt: string;
  signalCount: number;
  topicCounts: Record<string, number>;
  apgConnectionCounts: Record<string, number>;
  signals: ResearchSignal[];
  recommendations: ResearchSignalRecommendation[];
  cautions: string[];
};

export async function readResearchSignalJsonl(path: string): Promise<ResearchSignal[]> {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ResearchSignal)
    .filter(isResearchSignal);
}

export function buildResearchSignalIndex(signals: ResearchSignal[]): ResearchSignalIndex {
  const normalized = signals.map(normalizeSignal).sort((left, right) => left.id.localeCompare(right.id));
  return {
    version: "apg-research-signal-index/v0.1",
    generatedAt: `deterministic:${normalized.length}`,
    signalCount: normalized.length,
    topicCounts: countFlat(normalized.flatMap((signal) => signal.topics)),
    apgConnectionCounts: countFlat(normalized.flatMap((signal) => signal.apgConnections)),
    signals: normalized,
    recommendations: buildRecommendations(normalized),
    cautions: [
      "This index does not prove relevance to APG; it is not proof.",
      "Research signals are external hints, not claims of novelty or mathematical significance.",
      "Network collection should remain optional, throttled, cached, and respectful of source rules."
    ]
  };
}

export function renderResearchSignalMarkdown(index: ResearchSignalIndex): string {
  return `# Research Signal Index

## Summary

- Signals: ${index.signalCount}

## Topic Counts

${formatRecord(index.topicCounts)}

## APG Connection Counts

${formatRecord(index.apgConnectionCounts)}

## Recommendations

${index.recommendations.map((item) => `### ${item.title}

- Next action: ${item.nextAction}
- Reason: ${item.reason}`).join("\n\n") || "No recommendations."}

## Signals

${index.signals.map((signal) => `### ${signal.title}

- Source: ${signal.source}
- URL: ${signal.url}
- Confidence: ${signal.confidence}
- Topics: ${signal.topics.join(", ") || "none"}
- APG connections: ${signal.apgConnections.join(", ") || "none"}

${signal.summary}`).join("\n\n") || "No signals."}

## Cautions

${index.cautions.map((caution) => `- ${caution}`).join("\n")}
`;
}

function normalizeSignal(signal: ResearchSignal): ResearchSignal {
  return {
    ...signal,
    topics: [...new Set(signal.topics.map((topic) => topic.trim()).filter(Boolean))].sort(),
    apgConnections: [...new Set(signal.apgConnections.map((connection) => connection.trim()).filter(Boolean))].sort()
  };
}

function buildRecommendations(signals: ResearchSignal[]): ResearchSignalRecommendation[] {
  return signals
    .filter((signal) => signal.apgConnections.length > 0)
    .slice(0, 8)
    .map((signal) => ({
      title: signal.title,
      nextAction: nextActionFor(signal),
      reason: `Connected to ${signal.apgConnections.join(", ")} with ${signal.confidence} confidence.`
    }));
}

function nextActionFor(signal: ResearchSignal): ResearchSignalRecommendation["nextAction"] {
  const text = `${signal.topics.join(" ")} ${signal.apgConnections.join(" ")}`.toLowerCase();
  if (text.includes("trace") || text.includes("atlas")) {
    return "map_to_trace_atlas";
  }
  if (signal.confidence === "low") {
    return "save_for_later";
  }
  return "inspect_for_apg_relevance";
}

function countFlat(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function formatRecord(record: Record<string, number>): string {
  const rows = Object.entries(record).map(([key, value]) => `- ${key}: ${value}`);
  return rows.length > 0 ? rows.join("\n") : "- none";
}

function isResearchSignal(value: ResearchSignal): boolean {
  return Boolean(value?.id && value?.title && value?.url && Array.isArray(value?.topics) && Array.isArray(value?.apgConnections));
}
