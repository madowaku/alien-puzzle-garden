import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildTraceAtlas, renderTraceAtlasMarkdown } from "../src/atlas/traceAtlas.ts";
import { parseTraceAtlasArgs, runTraceAtlas } from "../src/commands/runTraceAtlas.ts";
import type { AlienTrace } from "../src/alien/alienTrace.ts";
import type { TranslationGate } from "../src/translation/translationGate.ts";

test("Trace Atlas aggregates translation decisions, reasons, and rule families", () => {
  const atlas = buildTraceAtlas([
    { trace: trace("APG-0001", ["R3:100", "R1:5"], ["best:80", "avg:10", "basins:6"]), gate: gate("APG-0001", "translate", 0.8, ["strong score contrast", "high rule pulse concentration"]) },
    { trace: trace("APG-0002", ["R3:70", "R2:20"], ["best:55", "avg:20", "basins:5"]), gate: gate("APG-0002", "translate", 0.7, ["strong score contrast", "multiple distinct basins"]) },
    { trace: trace("APG-0003", ["R1:5"], ["best:10", "avg:9", "basins:1"]), gate: gate("APG-0003", "do_not_translate", 0.1, ["low score contrast"]) }
  ]);

  assert.equal(atlas.experimentCount, 3);
  assert.equal(atlas.translationDecisionCounts.translate, 2);
  assert.equal(atlas.translationDecisionCounts.do_not_translate, 1);
  assert.equal(atlas.reasonCounts["strong score contrast"], 2);
  assert.equal(atlas.ruleFamilies[0]?.dominantRuleId, "R3");
  assert.deepEqual(atlas.translationCandidates.map((item) => item.experimentId), ["APG-0001", "APG-0002"]);
  assert.ok(atlas.quietTraces.some((item) => item.experimentId === "APG-0003"));
});

test("Trace Atlas markdown includes observatory cautions and candidate list", () => {
  const atlas = buildTraceAtlas([
    { trace: trace("APG-0001", ["R4:90"], ["best:80", "avg:10", "basins:6"]), gate: gate("APG-0001", "translate", 0.8, ["strong score contrast"]) }
  ]);
  const markdown = renderTraceAtlasMarkdown(atlas);

  assert.match(markdown, /# Trace Atlas/);
  assert.match(markdown, /Translation candidates/);
  assert.match(markdown, /This atlas does not prove a pattern/);
});

test("trace-atlas command scans experiments and writes atlas files", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-trace-atlas-"));

  try {
    await writeExperiment(experimentsDir, "APG-0001", trace("APG-0001", ["R3:100"], ["best:80", "avg:10", "basins:6"]), gate("APG-0001", "translate", 0.8, ["strong score contrast"]));
    await writeExperiment(experimentsDir, "APG-0002", trace("APG-0002", ["R1:4"], ["best:10", "avg:9", "basins:1"]), gate("APG-0002", "do_not_translate", 0.1, ["low score contrast"]));

    const result = await runTraceAtlas({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "trace_atlas.json"), "utf8"));
    const markdown = await readFile(join(experimentsDir, "trace_atlas.md"), "utf8");

    assert.deepEqual(result, { generated: true, message: "Generated Trace Atlas for 2 experiment(s)." });
    assert.equal(json.experimentCount, 2);
    assert.match(markdown, /APG-0001/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("trace-atlas command falls back when translation_gate.json is missing", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-trace-atlas-fallback-"));

  try {
    await writeExperiment(experimentsDir, "APG-0001", trace("APG-0001", ["R3:100"], ["best:80", "avg:10", "basins:6"]));

    const result = await runTraceAtlas({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "trace_atlas.json"), "utf8"));

    assert.equal(result.generated, true);
    assert.equal(json.translationDecisionCounts.translate, 1);
    assert.ok(json.cautions.some((caution: string) => /missing translation gates/i.test(caution)));
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("trace-atlas command reports no traces gracefully", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-trace-atlas-empty-"));

  try {
    const result = await runTraceAtlas({ experimentsDir, quiet: true });
    assert.deepEqual(result, {
      generated: false,
      message: "No alien_trace.json files found. Run npm run experiment first."
    });
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("trace-atlas CLI parser supports help", () => {
  assert.deepEqual(parseTraceAtlasArgs([]), {});
  assert.deepEqual(parseTraceAtlasArgs(["--help"]), { help: true });
  assert.deepEqual(parseTraceAtlasArgs(["--experiments-dir", "tmp/experiments"]), { experimentsDir: "tmp/experiments" });
});

async function writeExperiment(
  experimentsDir: string,
  experimentId: string,
  alienTrace: AlienTrace,
  translationGate?: TranslationGate
): Promise<void> {
  const experimentDir = join(experimentsDir, experimentId);
  await mkdir(experimentDir, { recursive: true });
  await writeFile(join(experimentDir, "alien_trace.json"), `${JSON.stringify(alienTrace, null, 2)}\n`, "utf8");
  if (translationGate) {
    await writeFile(join(experimentDir, "translation_gate.json"), `${JSON.stringify(translationGate, null, 2)}\n`, "utf8");
  }
}

function trace(experimentId: string, rulePulse: string[], scalarPulse: string[]): AlienTrace {
  return {
    version: "apg-alien-trace/v0.1",
    experimentId,
    seed: 123,
    humanTranslationPolicy: "translate_only_if_human_interesting",
    symbolMap: { A: "g0" },
    traceTape: `apg:${experimentId}|rule:${rulePulse.join(",")}|pulse:${scalarPulse.join(",")}`,
    channels: {
      rulePulse,
      finalStateGlyphs: [{ state: "A", glyphs: "g0", count: 1 }],
      runGlyphs: [],
      scalarPulse
    },
    cautions: []
  };
}

function gate(experimentId: string, decision: TranslationGate["decision"], humanInterestScore: number, reasons: string[]): TranslationGate {
  return {
    version: "apg-translation-gate/v0.1",
    experimentId,
    sourceTrace: "alien_trace.json",
    decision,
    humanInterestScore,
    translationMode: decision === "translate" ? "short_observatory_note" : "none",
    reasons,
    suggestedNote: `${experimentId} note`,
    cautions: []
  };
}
