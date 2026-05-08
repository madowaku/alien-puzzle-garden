import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { runNamingDebt, parseNamingDebtArgs } from "../src/commands/runNamingDebt.ts";
import { buildNamingDebtReport, renderNamingDebtMarkdown } from "../src/naming/namingDebt.ts";
import type {
  EvolutionParentCandidatesReport,
  EvolutionParentCandidate,
  PatternSurvivalIndex,
  PatternSurvivalIndexEntry
} from "../src/mutations/mutationTypes.ts";

test("naming-debt reads evolution candidates and survival index and writes reports", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-naming-debt-"));

  try {
    await writeInputs(experimentsDir, [
      candidate("Rewrite Bottleneck", "rename_or_split", "fragile_candidate", 0.2, 5),
      candidate("Lonely Gate", "needs_more_tests", "under_tested", 1, 1)
    ]);

    const result = await runNamingDebt({ experimentsDir, quiet: true });
    const json = JSON.parse(await readFile(join(experimentsDir, "naming_debt_report.json"), "utf8"));
    const markdown = await readFile(join(experimentsDir, "naming_debt_report.md"), "utf8");

    assert.equal(result.generated, true);
    assert.equal(json.entryCount, 2);
    assert.equal(json.entries[0].patternName, "Rewrite Bottleneck");
    assert.match(markdown, /## Observatory Note/);
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("naming-debt includes rename_or_split and needs_more_tests by default", () => {
  const report = buildNamingDebtReport(candidates([
    candidate("Rewrite Bottleneck", "rename_or_split", "fragile_candidate", 0.2, 5),
    candidate("Lonely Gate", "needs_more_tests", "under_tested", 1, 1)
  ]), index([
    entry("Rewrite Bottleneck", "fragile_candidate", 0.2, 5),
    entry("Lonely Gate", "under_tested", 1, 1)
  ]));

  assert.deepEqual(report.entries.map((item) => item.patternName), ["Rewrite Bottleneck", "Lonely Gate"]);
});

test("naming-debt excludes watchlist by default and includes it with flag", () => {
  const sourceCandidates = candidates([
    candidate("Shifting Gate", "watchlist", "unstable_candidate", 0.5, 4)
  ]);
  const sourceIndex = index([
    entry("Shifting Gate", "unstable_candidate", 0.5, 4)
  ]);

  assert.equal(buildNamingDebtReport(sourceCandidates, sourceIndex).entryCount, 0);
  assert.equal(buildNamingDebtReport(sourceCandidates, sourceIndex, { includeWatchlist: true }).entryCount, 1);
});

test("naming-debt excludes promote_to_parent entries", () => {
  const report = buildNamingDebtReport(candidates([
    candidate("Stable Gate", "promote_to_parent", "robust_candidate", 0.9, 5)
  ]), index([
    entry("Stable Gate", "robust_candidate", 0.9, 5)
  ]), { includeWatchlist: true });

  assert.equal(report.entryCount, 0);
});

test("naming-debt detects rule_attached and generates narrower name candidates", () => {
  const report = buildNamingDebtReport(candidates([
    candidate("Rewrite Bottleneck", "rename_or_split", "fragile_candidate", 0.2, 5)
  ]), index([
    entry("Rewrite Bottleneck", "fragile_candidate", 0.2, 5, ["remove_rule", "alter_rule_output"])
  ]));
  const debt = report.entries[0];

  assert.ok(debt?.debtReasons.includes("rule_attached"));
  assert.ok(debt?.debtReasons.includes("too_broad"));
  assert.ok(debt?.debtReasons.includes("split_candidate"));
  assert.match(debt?.narrowerNameCandidates.join("\n") ?? "", /Rule-Local Rewrite Bottleneck/);
  assert.match(debt?.narrowerNameCandidates.join("\n") ?? "", /Output-Dependent Gate/);
});

test("naming-debt detects under_evidenced from low mutation count", () => {
  const report = buildNamingDebtReport(candidates([
    candidate("Lonely Gate", "needs_more_tests", "under_tested", 1, 1)
  ]), index([
    entry("Lonely Gate", "under_tested", 1, 1)
  ]));

  assert.ok(report.entries[0]?.debtReasons.includes("under_evidenced"));
  assert.match(report.entries[0]?.narrowerNameCandidates.join("\n") ?? "", /Unconfirmed Lonely Gate/);
});

test("naming-debt markdown includes Observatory Note and broken-name language", () => {
  const markdown = renderNamingDebtMarkdown(buildNamingDebtReport(candidates([
    candidate("Rewrite Bottleneck", "rename_or_split", "fragile_candidate", 0.2, 5)
  ]), index([
    entry("Rewrite Bottleneck", "fragile_candidate", 0.2, 5)
  ])));

  assert.match(markdown, /# Naming Debt Report/);
  assert.match(markdown, /A name is not wrong because it breaks/);
});

test("naming-debt fails gracefully when inputs are missing", async () => {
  const experimentsDir = await mkdtemp(join(tmpdir(), "apg-naming-missing-"));

  try {
    let result = await runNamingDebt({ experimentsDir, quiet: true });
    assert.deepEqual(result, {
      generated: false,
      message: "No evolution_parent_candidates.json found. Run npm run evolution-candidates first."
    });

    await mkdir(experimentsDir, { recursive: true });
    await writeFile(join(experimentsDir, "evolution_parent_candidates.json"), `${JSON.stringify(candidates([]), null, 2)}\n`, "utf8");
    result = await runNamingDebt({ experimentsDir, quiet: true });
    assert.deepEqual(result, {
      generated: false,
      message: "No pattern_survival_index.json found. Run npm run survival-index first."
    });
  } finally {
    await rm(experimentsDir, { recursive: true, force: true });
  }
});

test("naming-debt CLI parser supports help and include-watchlist", () => {
  assert.deepEqual(parseNamingDebtArgs([]), { includeWatchlist: false });
  assert.deepEqual(parseNamingDebtArgs(["--help"]), { includeWatchlist: false, help: true });
  assert.deepEqual(parseNamingDebtArgs(["--include-watchlist"]), { includeWatchlist: true });
});

async function writeInputs(experimentsDir: string, sourceCandidates: EvolutionParentCandidate[]): Promise<void> {
  await mkdir(experimentsDir, { recursive: true });
  const sourceIndex = index(sourceCandidates.map((item) => entry(item.patternName, item.survivalClass, item.survivalScore, item.mutationResultCount)));
  await writeFile(join(experimentsDir, "evolution_parent_candidates.json"), `${JSON.stringify(candidates(sourceCandidates), null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "pattern_survival_index.json"), `${JSON.stringify(sourceIndex, null, 2)}\n`, "utf8");
}

function candidates(items: EvolutionParentCandidate[]): EvolutionParentCandidatesReport {
  return {
    generatedAt: "deterministic:test",
    sourceIndexPath: "pattern_survival_index.json",
    candidateCount: items.length,
    decisionCounts: { promote_to_parent: 0, watchlist: 0, rename_or_split: 0, needs_more_tests: 0 },
    candidates: items,
    cautions: ["Synthetic candidates."]
  };
}

function candidate(patternName: string, decision: EvolutionParentCandidate["decision"], survivalClass: EvolutionParentCandidate["survivalClass"], survivalScore: number, mutationResultCount: number): EvolutionParentCandidate {
  return {
    patternName,
    decision,
    survivalScore,
    survivalClass,
    mutationResultCount,
    sourceExperimentIds: ["APG-0001"],
    robustAgainst: ["seed_initial_symbol"],
    fragileAgainst: decision === "needs_more_tests" ? [] : ["remove_rule"],
    recommendation: "rename_or_split_pattern",
    rationale: "Synthetic candidate.",
    nextAction: "Synthetic next action.",
    cautions: ["Synthetic."]
  };
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

function entry(
  patternName: string,
  survivalClass: PatternSurvivalIndexEntry["survivalClass"],
  survivalScore: number,
  mutationResultCount: number,
  fragileAgainst: string[] = ["remove_rule"]
): PatternSurvivalIndexEntry {
  return {
    patternName,
    sourceExperimentIds: ["APG-0001"],
    mutationResultCount,
    statusCounts: { survived: 0, weakened: 0, broken: 0, inconclusive: 0 },
    survivalScore,
    survivalClass,
    robustAgainst: ["seed_initial_symbol"],
    fragileAgainst,
    commonMutationTypes: [...fragileAgainst, "increase_random_runs"],
    recommendation: "rename_or_split_pattern",
    notes: ["Synthetic index entry."]
  };
}
