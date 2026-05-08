import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { runExperiment } from "../src/experiments/runExperiment.ts";
import { buildMutationPlan, renderMutationPlanMarkdown } from "../src/mutations/mutationPlan.ts";
import { runMutationPlan, parseMutationPlanArgs } from "../src/commands/runMutationPlan.ts";
import type { LlmCriticOutput } from "../src/critics/criticSchema.ts";

const criticOutput: LlmCriticOutput = {
  summary: "Critic summary.",
  observedPatterns: [
    { title: "Early C Gate", evidence: "C appears early in top runs.", confidence: "medium" },
    { title: "Weak Pattern", evidence: "Small effect.", confidence: "low" }
  ],
  possibleInvariants: [
    {
      name: "D Cluster Drag",
      description: "D clusters may reduce compression.",
      whyItMightMatter: "It marks possible dead routes.",
      confidence: "low"
    }
  ],
  failureEcology: [],
  nextExperiments: [],
  mathFlavor: ["string rewriting"],
  humanMetaphor: "A gate in a folded alphabet.",
  madowakuNameCandidates: ["Early C Gate"],
  cautions: ["Not proof."]
};

test("buildMutationPlan uses highest-confidence critic pattern", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-build-"));

  try {
    await runExperiment({ count: 1, randomRuns: 3, seed: 910, outputDir, quiet: true });
    await writeFile(join(outputDir, "APG-0001", "llm_critic_raw.json"), `${JSON.stringify(criticOutput, null, 2)}\n`, "utf8");

    const plan = await buildMutationPlan(join(outputDir, "APG-0001"));

    assert.equal(plan.sourceExperimentId, "APG-0001");
    assert.equal(plan.sourcePattern.name, "Early C Gate");
    assert.equal(plan.sourcePattern.status, "pattern_candidate");
    assert.equal(plan.planStatus, "proposed_not_run");
    assert.ok(plan.mutations.length >= 3);
    assert.ok(plan.mutations.length <= 5);
    assert.ok(plan.mutations.some((mutation) => mutation.changeType === "remove_rule"));
    assert.ok(plan.cautions.some((caution) => /stress test/i.test(caution)));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("buildMutationPlan falls back to stats and puzzle without critic output", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-fallback-"));

  try {
    await runExperiment({ count: 1, randomRuns: 3, seed: 920, outputDir, quiet: true });
    const plan = await buildMutationPlan(join(outputDir, "APG-0001"));

    assert.equal(plan.sourcePattern.status, "fallback_candidate");
    assert.ok(plan.hypothesis.length > 0);
    assert.ok(plan.mutations.length >= 3);
    assert.ok(plan.mutations.every((mutation) => mutation.falsifiesIf.length > 0));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("renderMutationPlanMarkdown includes falsification language", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-md-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 930, outputDir, quiet: true });
    const plan = await buildMutationPlan(join(outputDir, "APG-0001"));
    const markdown = renderMutationPlanMarkdown(plan);

    assert.match(markdown, /^# Mutation Plan: APG-0001/m);
    assert.match(markdown, /## Source Pattern/);
    assert.match(markdown, /Falsifies if:/);
    assert.match(markdown, /This is a stress test, not a proof/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("runMutationPlan supports latest, all, and experiment selection", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-run-"));

  try {
    await runExperiment({ count: 2, randomRuns: 2, seed: 940, outputDir, quiet: true });

    const latest = await runMutationPlan({ experimentsDir: outputDir, latest: true, quiet: true });
    assert.deepEqual(latest.generated, ["APG-0002"]);

    const chosen = await runMutationPlan({ experimentsDir: outputDir, experimentId: "APG-0001", quiet: true });
    assert.deepEqual(chosen.generated, ["APG-0001"]);

    const all = await runMutationPlan({ experimentsDir: outputDir, all: true, quiet: true });
    assert.deepEqual(all.generated, ["APG-0001", "APG-0002"]);

    const json = JSON.parse(await readFile(join(outputDir, "APG-0002", "mutation_plan.json"), "utf8"));
    const markdown = await readFile(join(outputDir, "APG-0002", "mutation_plan.md"), "utf8");
    assert.equal(json.planStatus, "proposed_not_run");
    assert.match(markdown, /## Proposed Mutations/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("runMutationPlan reports unknown experiment gracefully", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mutation-missing-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 950, outputDir, quiet: true });
    const result = await runMutationPlan({ experimentsDir: outputDir, experimentId: "APG-9999", quiet: true });
    assert.deepEqual(result, { generated: [], skipped: ["Experiment APG-9999 was not found."] });
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("mutation-plan CLI parser defaults to latest and supports help", () => {
  assert.deepEqual(parseMutationPlanArgs([]), { latest: true });
  assert.deepEqual(parseMutationPlanArgs(["--all"]), { latest: false, all: true });
  assert.deepEqual(parseMutationPlanArgs(["--experiment", "APG-0003"]), { latest: false, experimentId: "APG-0003" });
  assert.deepEqual(parseMutationPlanArgs(["--help"]), { latest: true, help: true });
});
