import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResearchSignalIndex,
  readResearchSignalJsonl,
  renderResearchSignalMarkdown,
  type ResearchSignal
} from "../src/research/researchSignals.ts";
import { parseResearchSignalsArgs, runResearchSignals } from "../src/commands/runResearchSignals.ts";

const signals: ResearchSignal[] = [
  {
    id: "sig-1",
    title: "String rewriting and symbolic dynamics",
    url: "https://example.test/string",
    source: "fixture",
    publishedAt: "2026-05-01",
    topics: ["string rewriting", "symbolic dynamics"],
    apgConnections: ["symbol rewrite puzzle", "pattern survival"],
    confidence: "medium",
    summary: "A fixture signal about rewrite systems."
  },
  {
    id: "sig-2",
    title: "Graph rewriting survey",
    url: "https://example.test/graph",
    source: "fixture",
    topics: ["graph rewriting"],
    apgConnections: ["graph transform puzzle"],
    confidence: "low",
    summary: "A fixture signal about graph transforms."
  }
];

test("research signal index groups topics and APG connections", () => {
  const index = buildResearchSignalIndex([...signals]);

  assert.equal(index.signalCount, 2);
  assert.equal(index.topicCounts["string rewriting"], 1);
  assert.equal(index.topicCounts["graph rewriting"], 1);
  assert.equal(index.apgConnectionCounts["pattern survival"], 1);
  assert.equal(index.recommendations[0]?.nextAction, "inspect_for_apg_relevance");
  assert.ok(index.cautions.some((caution) => /not proof/i.test(caution)));
});

test("research signal markdown includes local sidecar cautions", () => {
  const markdown = renderResearchSignalMarkdown(buildResearchSignalIndex([...signals]));

  assert.match(markdown, /# Research Signal Index/);
  assert.match(markdown, /string rewriting/);
  assert.match(markdown, /This index does not prove relevance/);
});

test("readResearchSignalJsonl parses newline-delimited sidecar output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-research-jsonl-"));
  const filePath = join(dir, "signals.jsonl");

  try {
    await writeFile(filePath, `${signals.map((signal) => JSON.stringify(signal)).join("\n")}\n`, "utf8");
    const parsed = await readResearchSignalJsonl(filePath);

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.title, "String rewriting and symbolic dynamics");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("research-signals command reads JSONL and writes index files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-research-signals-"));
  const inputPath = join(dir, "signals.jsonl");
  const outputDir = join(dir, "experiments");

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, `${signals.map((signal) => JSON.stringify(signal)).join("\n")}\n`, "utf8");

    const result = await runResearchSignals({ inputPath, outputDir, quiet: true });
    const json = JSON.parse(await readFile(join(outputDir, "research_signal_index.json"), "utf8"));
    const markdown = await readFile(join(outputDir, "research_signal_index.md"), "utf8");

    assert.deepEqual(result, { generated: true, message: "Generated Research Signal Index for 2 signal(s)." });
    assert.equal(json.signalCount, 2);
    assert.match(markdown, /Graph Transform Puzzle/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("research-signals command reports missing input gracefully", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-research-missing-"));

  try {
    const result = await runResearchSignals({ inputPath: join(dir, "missing.jsonl"), outputDir: dir, quiet: true });
    assert.equal(result.generated, false);
    assert.match(result.message, /No research signal JSONL found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("research-signals CLI parser supports input and output", () => {
  assert.deepEqual(parseResearchSignalsArgs([]), {});
  assert.deepEqual(parseResearchSignalsArgs(["--help"]), { help: true });
  assert.deepEqual(parseResearchSignalsArgs(["--input", "signals.jsonl", "--output-dir", "out"]), {
    inputPath: "signals.jsonl",
    outputDir: "out"
  });
});
