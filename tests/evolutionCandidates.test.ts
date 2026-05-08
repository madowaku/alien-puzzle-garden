import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { runEvolutionCandidates, parseEvolutionCandidatesArgs } from "../src/commands/runEvolutionCandidates.ts";
import { buildEvolutionParentCandidatesReport, renderEvolutionParentCandidatesMarkdown } from "../src/evolution/evolutionCandidates.ts";
import type { PatternSurvivalIndex, PatternSurvivalIndexEntry } from "../src/mutations/mutationTypes.ts";

test("evolution-candidates reads pattern_survival_index and writes candidate files", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-evolution-candidates-"));

  try {
    await writeIndex(experimentsDir, [
      entry("Early C Gate", "robust_candidate", 0.86, 4),
      entry("Rewrite Bottleneck", "fragile_candidate", 0.25, 5)
    ]);

    const result = await runEvolutionCandidates({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "evolution_parent_candidates.json"), "utf8"));
    const markdown = await readFile(join(experimentsDir, "evolution_parent_candidates.md"), "utf8");

    assert.equal(result.generated, true);
    assert.equal(json.candidateCount, 2);
    assert.equal(json.candidates[0].patternName, "Early C Gate");
    assert.equal(json.candidates[0].decision, "promote_to_parent");
    assert.match(markdown, /## Observatory Note/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("evolution-candidates classifies robust candidates as promote_to_parent when thresholds pass", () => {
  const report = buildEvolutionParentCandidatesReport(index([
    entry("Stable Gate", "robust_candidate", 0.8, 3)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" });

  assert.equal(report.candidates[0]?.decision, "promote_to_parent");
  assert.equal(report.decisionCounts.promote_to_parent, 1);
});

test("evolution-candidates classifies unstable candidates as watchlist", () => {
  const report = buildEvolutionParentCandidatesReport(index([
    entry("Shifting Gate", "unstable_candidate", 0.5, 3)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" });

  assert.equal(report.candidates[0]?.decision, "watchlist");
});

test("evolution-candidates classifies fragile candidates as rename_or_split", () => {
  const report = buildEvolutionParentCandidatesReport(index([
    entry("Brittle Gate", "fragile_candidate", 0.2, 5)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" });

  assert.equal(report.candidates[0]?.decision, "rename_or_split");
});

test("evolution-candidates classifies under-tested candidates as needs_more_tests", () => {
  const report = buildEvolutionParentCandidatesReport(index([
    entry("Lonely Gate", "under_tested", 1, 1)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" });

  assert.equal(report.candidates[0]?.decision, "needs_more_tests");
});

test("evolution-candidates respects min-score and min-results thresholds", () => {
  const report = buildEvolutionParentCandidatesReport(index([
    entry("Almost Gate", "robust_candidate", 0.74, 4),
    entry("Sparse Gate", "robust_candidate", 0.9, 2)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" });

  const byName = new Map(report.candidates.map((candidate) => [candidate.patternName, candidate.decision]));

  assert.equal(byName.get("Almost Gate"), "watchlist");
  assert.equal(byName.get("Sparse Gate"), "needs_more_tests");
});

test("evolution-candidates markdown includes selection cautions", () => {
  const markdown = renderEvolutionParentCandidatesMarkdown(buildEvolutionParentCandidatesReport(index([
    entry("Early C Gate", "robust_candidate", 0.8, 3)
  ]), { minScore: 0.75, minResults: 3, sourceIndexPath: "pattern_survival_index.json" }));

  assert.match(markdown, /# Evolution Parent Candidates/);
  assert.match(markdown, /Parent selection is not proof of mathematical importance/);
});

test("evolution-candidates fails gracefully when index is missing", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-evolution-empty-"));

  try {
    const result = await runEvolutionCandidates({ experimentsDir, quiet: true });
    assert.deepEqual(result, {
      generated: false,
      message: "No pattern_survival_index.json found. Run npm run survival-index first."
    });
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("evolution-candidates CLI parser supports help and thresholds", () => {
  assert.deepEqual(parseEvolutionCandidatesArgs([]), { minScore: 0.75, minResults: 3 });
  assert.deepEqual(parseEvolutionCandidatesArgs(["--help"]), { minScore: 0.75, minResults: 3, help: true });
  assert.deepEqual(parseEvolutionCandidatesArgs(["--min-score", "0.8", "--min-results", "5"]), { minScore: 0.8, minResults: 5 });
});

async function writeIndex(experimentsDir: string, entries: PatternSurvivalIndexEntry[]): Promise<void> {
  await mkdir(experimentsDir, { recursive: true });
  await writeFile(join(experimentsDir, "pattern_survival_index.json"), `${JSON.stringify(index(entries), null, 2)}\n`, "utf8");
}

function index(entries: PatternSurvivalIndexEntry[]): PatternSurvivalIndex {
  return {
    generatedAt: "deterministic:test",
    experimentCount: entries.length,
    mutationResultCount: entries.reduce((sum, item) => sum + item.mutationResultCount, 0),
    statusCounts: { survived: 0, weakened: 0, broken: 0, inconclusive: 0 },
    entries,
    cautions: ["Synthetic index."]
  };
}

function entry(patternName: string, survivalClass: PatternSurvivalIndexEntry["survivalClass"], survivalScore: number, mutationResultCount: number): PatternSurvivalIndexEntry {
  return {
    patternName,
    sourceExperimentIds: ["APG-0001"],
    mutationResultCount,
    statusCounts: { survived: 0, weakened: 0, broken: 0, inconclusive: 0 },
    survivalScore,
    survivalClass,
    robustAgainst: ["change_max_steps"],
    fragileAgainst: ["remove_rule"],
    commonMutationTypes: ["change_max_steps", "remove_rule"],
    recommendation: "rerun_with_more_mutations",
    notes: [`${patternName} test note.`]
  };
}
