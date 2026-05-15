import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildTranslationGate, renderTranslationNoteMarkdown } from "../src/translation/translationGate.ts";
import { parseTranslationGateArgs, runTranslationGate } from "../src/commands/runTranslationGate.ts";
import type { AlienTrace } from "../src/alien/alienTrace.ts";

test("translation gate marks high-contrast alien traces for human translation", () => {
  const gate = buildTranslationGate(trace({
    experimentId: "APG-0001",
    best: 80,
    avg: 12,
    basins: 8,
    rulePulse: ["R3:120", "R1:5", "R2:4"],
    finalStates: 5
  }));

  assert.equal(gate.experimentId, "APG-0001");
  assert.equal(gate.decision, "translate");
  assert.ok(gate.humanInterestScore >= 0.65);
  assert.ok(gate.reasons.includes("strong score contrast"));
  assert.ok(gate.reasons.includes("high rule pulse concentration"));
  assert.equal(gate.translationMode, "short_observatory_note");
  assert.match(renderTranslationNoteMarkdown(gate), /# Translation Note: APG-0001/);
});

test("translation gate keeps quiet for low-signal alien traces", () => {
  const gate = buildTranslationGate(trace({
    experimentId: "APG-0002",
    best: 10,
    avg: 9,
    basins: 1,
    rulePulse: ["R1:3", "R2:2"],
    finalStates: 1
  }));

  assert.equal(gate.decision, "do_not_translate");
  assert.ok(gate.humanInterestScore < 0.65);
  assert.ok(gate.reasons.includes("low score contrast"));
  assert.equal(gate.translationMode, "none");
});

test("translation-gate command writes JSON and note for latest experiment", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-translation-gate-"));

  try {
    await writeExperimentTrace(experimentsDir, "APG-0001", trace({
      experimentId: "APG-0001",
      best: 70,
      avg: 8,
      basins: 6,
      rulePulse: ["R4:100", "R1:5"],
      finalStates: 4
    }));

    const result = await runTranslationGate({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "APG-0001", "translation_gate.json"), "utf8"));
    const note = await readFile(join(experimentsDir, "APG-0001", "translation_note.md"), "utf8");

    assert.deepEqual(result, { generated: ["APG-0001"], skipped: [] });
    assert.equal(json.decision, "translate");
    assert.match(note, /Human Interest Score/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("translation-gate command writes JSON only when decision is do_not_translate", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-translation-gate-quiet-"));

  try {
    await writeExperimentTrace(experimentsDir, "APG-0001", trace({
      experimentId: "APG-0001",
      best: 10,
      avg: 9,
      basins: 1,
      rulePulse: ["R1:3"],
      finalStates: 1
    }));

    const result = await runTranslationGate({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "APG-0001", "translation_gate.json"), "utf8"));

    assert.deepEqual(result, { generated: ["APG-0001"], skipped: [] });
    assert.equal(json.decision, "do_not_translate");
    await assert.rejects(() => readFile(join(experimentsDir, "APG-0001", "translation_note.md"), "utf8"));
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("translation-gate skips experiments missing alien_trace.json", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-translation-gate-missing-"));

  try {
    await mkdir(join(experimentsDir, "APG-0001"), { recursive: true });
    const result = await runTranslationGate({ experimentsDir, quiet: true });

    assert.equal(result.generated.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0], /alien_trace\.json/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("translation-gate CLI parser supports selection and help", () => {
  assert.deepEqual(parseTranslationGateArgs([]), { latest: true });
  assert.deepEqual(parseTranslationGateArgs(["--all"]), { latest: false, all: true });
  assert.deepEqual(parseTranslationGateArgs(["--latest"]), { latest: true, all: false });
  assert.deepEqual(parseTranslationGateArgs(["--experiment", "APG-0003"]), { latest: false, experimentId: "APG-0003" });
  assert.deepEqual(parseTranslationGateArgs(["--help"]), { latest: true, help: true });
});

async function writeExperimentTrace(experimentsDir: string, experimentId: string, alienTrace: AlienTrace): Promise<void> {
  const experimentDir = join(experimentsDir, experimentId);
  await mkdir(experimentDir, { recursive: true });
  await writeFile(join(experimentDir, "alien_trace.json"), `${JSON.stringify(alienTrace, null, 2)}\n`, "utf8");
}

function trace(options: {
  experimentId: string;
  best: number;
  avg: number;
  basins: number;
  rulePulse: string[];
  finalStates: number;
}): AlienTrace {
  return {
    version: "apg-alien-trace/v0.1",
    experimentId: options.experimentId,
    seed: 123,
    humanTranslationPolicy: "translate_only_if_human_interesting",
    symbolMap: { A: "g0", B: "g1" },
    traceTape: `apg:${options.experimentId}|pulse:best:${options.best},avg:${options.avg},basins:${options.basins}`,
    channels: {
      rulePulse: options.rulePulse,
      finalStateGlyphs: Array.from({ length: options.finalStates }, (_, index) => ({
        state: `S${index}`,
        glyphs: `g${index}`,
        count: 1
      })),
      runGlyphs: [],
      scalarPulse: [
        `best:${options.best}`,
        `avg:${options.avg}`,
        "len:4",
        `basins:${options.basins}`,
        "runs:10"
      ]
    },
    cautions: ["Synthetic trace."]
  };
}
