import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { runExperiment } from "../src/experiments/runExperiment.ts";
import { runMutationPlan } from "../src/commands/runMutationPlan.ts";
import { runMutationRun, parseMutationRunArgs } from "../src/commands/runMutationRun.ts";
import type { MutationPlan } from "../src/mutations/mutationTypes.ts";

test("mutation-run reads mutation_plan and writes survival artifacts", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-runner-"));

  try {
    await runExperiment({ count: 1, randomRuns: 3, seed: 1000, outputDir, quiet: true });
    await runMutationPlan({ experimentsDir: outputDir, latest: true, quiet: true });
    const result = await runMutationRun({ experimentsDir: outputDir, latest: true, quiet: true });

    assert.deepEqual(result.generated, ["APG-0001"]);

    const survival = JSON.parse(await readFile(join(outputDir, "APG-0001", "survival_report.json"), "utf8"));
    const markdown = await readFile(join(outputDir, "APG-0001", "survival_report.md"), "utf8");
    const mutationResult = JSON.parse(await readFile(join(outputDir, "APG-0001", "mutations", "MUT-001", "mutation_result.json"), "utf8"));

    assert.equal(survival.planStatus, "run");
    assert.ok(Array.isArray(survival.results));
    assert.match(markdown, /## Overall Status/);
    assert.match(markdown, /Pattern Candidate/);
    assert.equal(mutationResult.mutationId, "MUT-001");
    assert.equal(typeof mutationResult.comparison.bestScoreDelta, "number");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("remove_rule creates mutated puzzle with target rule removed", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-remove-rule-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 1010, outputDir, quiet: true });
    await runMutationPlan({ experimentsDir: outputDir, latest: true, quiet: true });
    const plan = JSON.parse(await readFile(join(outputDir, "APG-0001", "mutation_plan.json"), "utf8")) as MutationPlan;
    const ruleId = String(plan.mutations[0]?.change.ruleId);

    await runMutationRun({ experimentsDir: outputDir, latest: true, quiet: true });
    const mutatedPuzzle = JSON.parse(await readFile(join(outputDir, "APG-0001", "mutations", "MUT-001", "mutated_puzzle.json"), "utf8"));

    assert.equal(mutatedPuzzle.rules.some((rule: { id: string }) => rule.id === ruleId), false);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("seed_initial_symbol changes the initial string", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-seed-symbol-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 1020, outputDir, quiet: true });
    await runMutationPlan({ experimentsDir: outputDir, latest: true, quiet: true });
    await runMutationRun({ experimentsDir: outputDir, latest: true, quiet: true });

    const sourcePuzzle = JSON.parse(await readFile(join(outputDir, "APG-0001", "puzzle.json"), "utf8"));
    const mutatedPuzzle = JSON.parse(await readFile(join(outputDir, "APG-0001", "mutations", "MUT-003", "mutated_puzzle.json"), "utf8"));

    assert.notEqual(mutatedPuzzle.initial, sourcePuzzle.initial);
    assert.equal(mutatedPuzzle.initial.length, sourcePuzzle.initial.length + 1);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("unsupported mutation becomes inconclusive instead of crashing", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-unsupported-mutation-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 1030, outputDir, quiet: true });
    await runMutationPlan({ experimentsDir: outputDir, latest: true, quiet: true });
    const planPath = join(outputDir, "APG-0001", "mutation_plan.json");
    const plan = JSON.parse(await readFile(planPath, "utf8")) as MutationPlan;
    plan.mutations = [{
      id: "MUT-X",
      title: "Unsupported scoring hint change",
      changeType: "change_scoring_hint",
      rationale: "Unsupported in runner.",
      change: { hint: "new hint" },
      expectedObservation: "No expectation.",
      falsifiesIf: "No falsifier.",
      risk: "Unsupported."
    }];
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    const result = await runMutationRun({ experimentsDir: outputDir, latest: true, quiet: true });
    const mutationResult = JSON.parse(await readFile(join(outputDir, "APG-0001", "mutations", "MUT-X", "mutation_result.json"), "utf8"));

    assert.deepEqual(result.generated, ["APG-0001"]);
    assert.equal(mutationResult.status, "inconclusive");
    assert.match(mutationResult.cautions.join("\n"), /Unsupported mutation change type/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("missing mutation_plan fails gracefully", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-missing-mutation-plan-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 1040, outputDir, quiet: true });
    const result = await runMutationRun({ experimentsDir: outputDir, latest: true, quiet: true });
    assert.deepEqual(result, {
      generated: [],
      skipped: ["No mutation_plan.json found for APG-0001. Run npm run mutation-plan first."]
    });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("mutation-run CLI parser defaults to latest and supports selection", () => {
  assert.deepEqual(parseMutationRunArgs([]), { latest: true });
  assert.deepEqual(parseMutationRunArgs(["--all"]), { latest: false, all: true });
  assert.deepEqual(parseMutationRunArgs(["--experiment", "APG-0003"]), { latest: false, experimentId: "APG-0003" });
  assert.deepEqual(parseMutationRunArgs(["--help"]), { latest: true, help: true });
});
