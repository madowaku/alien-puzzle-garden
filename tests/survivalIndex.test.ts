import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { runSurvivalIndex, parseSurvivalIndexArgs } from "../src/commands/runSurvivalIndex.ts";
import { buildPatternSurvivalIndex, renderPatternSurvivalIndexMarkdown } from "../src/survival/patternSurvivalIndex.ts";
import type { SurvivalReport } from "../src/mutations/mutationTypes.ts";

test("Pattern Survival Index scans multiple survival reports and aggregates by pattern name", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-survival-index-"));

  try {
    await writeSurvivalReport(experimentsDir, "APG-0001", "Early C Gate", ["survived", "weakened"]);
    await writeSurvivalReport(experimentsDir, "APG-0002", "Early C Gate", ["broken"]);
    await writeSurvivalReport(experimentsDir, "APG-0003", "Rewrite Bottleneck", ["survived"]);

    const result = await runSurvivalIndex({ experimentsDir, minRuns: 2, quiet: true });

    assert.equal(result.generated, true);
    const index = JSON.parse(await readFile(join(experimentsDir, "pattern_survival_index.json"), "utf8"));
    const markdown = await readFile(join(experimentsDir, "pattern_survival_index.md"), "utf8");
    const earlyGate = index.entries.find((entry: { patternName: string }) => entry.patternName === "Early C Gate");

    assert.equal(index.experimentCount, 3);
    assert.equal(index.mutationResultCount, 4);
    assert.deepEqual(earlyGate.sourceExperimentIds, ["APG-0001", "APG-0002"]);
    assert.equal(earlyGate.mutationResultCount, 3);
    assert.match(markdown, /This index does not prove a pattern/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("Pattern Survival Index computes scores and robust classification", () => {
  const index = buildPatternSurvivalIndex([
    report("APG-0001", "Stable Gate", ["survived", "survived", "weakened"])
  ], { minRuns: 2 });

  assert.equal(index.entries[0]?.survivalScore, 0.83);
  assert.equal(index.entries[0]?.survivalClass, "robust_candidate");
});

test("Pattern Survival Index classifies unstable, fragile, and under-tested candidates", () => {
  const index = buildPatternSurvivalIndex([
    report("APG-0001", "Unstable Gate", ["survived", "broken"]),
    report("APG-0002", "Fragile Gate", ["broken", "inconclusive"]),
    report("APG-0003", "Lonely Gate", ["survived"])
  ], { minRuns: 2 });

  const byName = new Map(index.entries.map((entry) => [entry.patternName, entry.survivalClass]));

  assert.equal(byName.get("Unstable Gate"), "unstable_candidate");
  assert.equal(byName.get("Fragile Gate"), "fragile_candidate");
  assert.equal(byName.get("Lonely Gate"), "under_tested");
});

test("Pattern Survival Index detects robust and fragile mutation pressure", () => {
  const index = buildPatternSurvivalIndex([
    {
      ...report("APG-0001", "Pressure Map", []),
      results: [
        mutation("MUT-001", "remove_rule", "broken"),
        mutation("MUT-002", "remove_rule", "broken"),
        mutation("MUT-003", "change_max_steps", "survived"),
        mutation("MUT-004", "change_max_steps", "weakened")
      ]
    }
  ], { minRuns: 2 });

  assert.deepEqual(index.entries[0]?.fragileAgainst, ["remove_rule"]);
  assert.deepEqual(index.entries[0]?.robustAgainst, ["change_max_steps"]);
  assert.deepEqual(index.entries[0]?.commonMutationTypes, ["change_max_steps", "remove_rule"]);
});

test("runSurvivalIndex fails gracefully when no survival reports exist", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-survival-index-empty-"));

  try {
    await mkdir(join(experimentsDir, "APG-0001"), { recursive: true });
    const result = await runSurvivalIndex({ experimentsDir, quiet: true });
    assert.deepEqual(result, {
      generated: false,
      message: "No survival_report.json files found. Run npm run mutation-run first."
    });
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("survival-index CLI parser supports help and min-runs", () => {
  assert.deepEqual(parseSurvivalIndexArgs([]), { minRuns: 2 });
  assert.deepEqual(parseSurvivalIndexArgs(["--help"]), { minRuns: 2, help: true });
  assert.deepEqual(parseSurvivalIndexArgs(["--min-runs", "4"]), { minRuns: 4 });
});

test("Pattern Survival Index markdown includes local-observation cautions", () => {
  const markdown = renderPatternSurvivalIndexMarkdown(buildPatternSurvivalIndex([
    report("APG-0001", "Early C Gate", ["survived", "broken"])
  ], { minRuns: 2 }));

  assert.match(markdown, /# Pattern Survival Index/);
  assert.match(markdown, /## Observatory Note/);
  assert.match(markdown, /This index does not prove a pattern/);
});

async function writeSurvivalReport(experimentsDir: string, id: string, patternName: string, statuses: SurvivalReport["results"][number]["status"][]): Promise<void> {
  const dir = join(experimentsDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "survival_report.json"), `${JSON.stringify(report(id, patternName, statuses), null, 2)}\n`, "utf8");
}

function report(id: string, patternName: string, statuses: SurvivalReport["results"][number]["status"][]): SurvivalReport {
  return {
    sourceExperimentId: id,
    sourcePatternName: patternName,
    hypothesis: `${patternName} may survive local mutation pressure.`,
    planStatus: "run",
    results: statuses.map((status, index) => mutation(`MUT-${String(index + 1).padStart(3, "0")}`, index % 2 === 0 ? "remove_rule" : "change_max_steps", status)),
    overallStatus: statuses[0] ?? "inconclusive",
    summary: `${patternName} summary.`,
    cautions: ["Local comparison only."]
  };
}

function mutation(id: string, changeType: SurvivalReport["results"][number]["changeType"], status: SurvivalReport["results"][number]["status"]): SurvivalReport["results"][number] {
  return {
    sourceExperimentId: "APG-0001",
    mutationId: id,
    title: `${changeType} test`,
    changeType,
    status,
    mutatedPuzzleId: `APG-0001-${id}`,
    comparison: {
      sourceBestScore: 10,
      mutatedBestScore: status === "broken" ? 5 : 10,
      bestScoreDelta: status === "broken" ? -5 : 0,
      sourceAverageScore: 5,
      mutatedAverageScore: status === "broken" ? 1 : 5,
      averageScoreDelta: status === "broken" ? -4 : 0,
      sourceDistinctFinalStates: 2,
      mutatedDistinctFinalStates: 2,
      distinctFinalStatesDelta: 0,
      sourceAverageFinalLength: 3,
      mutatedAverageFinalLength: 3,
      averageFinalLengthDelta: 0
    },
    interpretation: "Synthetic test result.",
    cautions: ["Synthetic."]
  };
}
