import test from "node:test";
import assert from "node:assert/strict";

import { buildObservatoryCards } from "../src/viewer/observatoryCards.ts";

test("survival_report.json produces status counts card", () => {
  const cards = buildObservatoryCards("survival_report.json", JSON.stringify({
    sourcePatternName: "Early C Gate",
    overallStatus: "weakened",
    hypothesis: "C may act as a gate.",
    results: [
      { status: "survived" },
      { status: "broken" },
      { status: "broken" },
      { status: "inconclusive" }
    ]
  }), "json");

  assert.equal(cards[0]?.title, "Pattern Survival");
  assert.deepEqual(cards[0]?.rows.map((row) => [row.label, row.value]), [
    ["Pattern", "Early C Gate"],
    ["Overall status", "weakened"],
    ["Hypothesis", "C may act as a gate."],
    ["Result count", "4"],
    ["survived", "1"],
    ["weakened", "0"],
    ["broken", "2"],
    ["inconclusive", "1"]
  ]);
});

test("pattern_survival_index.json produces top entries", () => {
  const cards = buildObservatoryCards("pattern_survival_index.json", JSON.stringify({
    experimentCount: 5,
    mutationResultCount: 12,
    statusCounts: { survived: 3, weakened: 4, broken: 2, inconclusive: 3 },
    entries: [
      { patternName: "Low", survivalScore: 0.1, survivalClass: "fragile_candidate" },
      { patternName: "High", survivalScore: 0.9, survivalClass: "robust_candidate" },
      { patternName: "Mid", survivalScore: 0.5, survivalClass: "unstable_candidate" },
      { patternName: "Second", survivalScore: 0.7, survivalClass: "unstable_candidate" }
    ]
  }), "json");

  assert.equal(cards[0]?.title, "Survival Index");
  assert.ok(cards[0]?.rows.some((row) => row.label === "Top entries" && row.value.includes("High")));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Top entries" && row.value.includes("Second")));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Top entries" && !row.value.includes("Low")));
});

test("evolution_parent_candidates.json produces decision counts", () => {
  const cards = buildObservatoryCards("evolution_parent_candidates.json", JSON.stringify({
    candidateCount: 4,
    decisionCounts: { promote_to_parent: 1, watchlist: 1, rename_or_split: 2, needs_more_tests: 0 },
    candidates: [
      { patternName: "Core", decision: "promote_to_parent", survivalScore: 0.8 },
      { patternName: "Bottleneck", decision: "rename_or_split", survivalScore: 0.2 }
    ]
  }), "json");

  assert.equal(cards[0]?.title, "Evolution Candidates");
  assert.ok(cards[0]?.rows.some((row) => row.label === "promote_to_parent" && row.value === "1"));
  assert.ok(cards[0]?.rows.some((row) => row.label === "rename_or_split" && row.value === "2"));
});

test("naming_debt_report.json produces debt reason counts", () => {
  const cards = buildObservatoryCards("naming_debt_report.json", JSON.stringify({
    entryCount: 2,
    entries: [
      { debtReasons: ["rule_attached", "too_broad"], nextAction: "split", narrowerNameCandidates: ["Rule-Local Gate", "Output Gate"] },
      { debtReasons: ["too_broad"], nextAction: "rename", narrowerNameCandidates: ["Narrow Gate"] }
    ]
  }), "json");

  assert.equal(cards[0]?.title, "Naming Debt");
  assert.ok(cards[0]?.rows.some((row) => row.label === "too_broad" && row.value === "2"));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Narrower names" && row.value.includes("Rule-Local Gate")));
});

test("trace_atlas.json produces atlas summary cards", () => {
  const cards = buildObservatoryCards("trace_atlas.json", JSON.stringify({
    experimentCount: 4,
    translationDecisionCounts: { translate: 2, do_not_translate: 2 },
    reasonCounts: {
      "strong score contrast": 2,
      "high rule pulse concentration": 1
    },
    ruleFamilies: [
      { dominantRuleId: "R3", count: 2, averageHumanInterestScore: 0.75, experimentIds: ["APG-0001", "APG-0002"] },
      { dominantRuleId: "R1", count: 1, averageHumanInterestScore: 0.2, experimentIds: ["APG-0003"] }
    ],
    translationCandidates: [
      { experimentId: "APG-0001", humanInterestScore: 0.85, dominantRuleId: "R3", reasons: ["strong score contrast"] },
      { experimentId: "APG-0002", humanInterestScore: 0.72, dominantRuleId: "R3", reasons: ["multiple distinct basins"] }
    ],
    quietTraces: [
      { experimentId: "APG-0003", humanInterestScore: 0.1, dominantRuleId: "R1", reasons: ["low score contrast"] }
    ]
  }), "json");

  assert.equal(cards[0]?.title, "Trace Atlas");
  assert.ok(cards[0]?.rows.some((row) => row.label === "experimentCount" && row.value === "4"));
  assert.ok(cards[0]?.rows.some((row) => row.label === "translate" && row.value === "2"));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Top reasons" && row.value.includes("strong score contrast: 2")));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Top rule families" && row.value.includes("R3 (2, 0.75)")));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Translation candidates" && row.value.includes("APG-0001")));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Quiet traces" && row.value.includes("APG-0003")));
});

test("report.md extracts madowaku name candidate", () => {
  const cards = buildObservatoryCards("report.md", `# Report

- Best score: 42
- Average score: 12.5
- Best final state: ABCA
- Best solver: beam
- Distinct final states: 7
- madowaku Name Candidate: Early C Gate
`, "markdown");

  assert.equal(cards[0]?.title, "Experiment Snapshot");
  assert.ok(cards[0]?.rows.some((row) => row.label === "madowaku Name Candidate" && row.value === "Early C Gate"));
});

test("mutation report.md uses Mutation Snapshot and extracts survival status", () => {
  const cards = buildObservatoryCards("experiments/APG-0005/mutations/MUT-005/report.md", `# Mutation Result: MUT-005

## Survival Status

broken

## Comparison

- Best score: 41 -> 41
- Average score: -83.15 -> -85.56
- Distinct final states: 47 -> 96

## Cautions

- This is a deterministic heuristic comparison, not proof.
`, "markdown");

  assert.equal(cards[0]?.title, "Mutation Snapshot");
  assert.ok(cards[0]?.rows.some((row) => row.label === "Survival Status" && row.value === "broken" && row.badge === "broken"));
  assert.ok(cards[0]?.rows.some((row) => row.label === "Cautions" && row.value === "present"));
});

test("malformed JSON does not crash and returns no cards", () => {
  assert.deepEqual(buildObservatoryCards("survival_report.json", "{ nope", "json"), []);
});
