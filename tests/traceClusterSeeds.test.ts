import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTraceClusterSeeds,
  renderTraceClusterSeedsMarkdown,
  type TraceClusterSeedInput
} from "../src/atlas/traceClusterSeeds.ts";
import { parseTraceClusterSeedsArgs, runTraceClusterSeeds } from "../src/commands/runTraceClusterSeeds.ts";

test("Trace Cluster Seeds group trace families by local signals and vocabulary hints", () => {
  const seeds = buildTraceClusterSeeds(input());

  assert.equal(seeds.seedCount, 2);
  assert.equal(seeds.seeds[0]?.clusterId, "TCS-001");
  assert.deepEqual(seeds.seeds[0]?.basis, ["dominant_rule_family", "translation_reason", "human_interest_band", "decision", "vocabulary_hint"]);
  assert.ok(seeds.seeds[0]?.experiments.includes("APG-0001"));
  assert.ok(seeds.seeds[0]?.localSignals.includes("basin diversity"));
  assert.ok(seeds.seeds[0]?.vocabularyHints.includes("string rewriting"));
  assert.equal(seeds.seeds[0]?.translationPolicy, "candidate_for_future_translation");
  assert.ok(seeds.seeds[0]?.cautions.some((caution) => /not a proven pattern/i.test(caution)));
});

test("Trace Cluster Seeds markdown includes cautions and vocabulary", () => {
  const markdown = renderTraceClusterSeedsMarkdown(buildTraceClusterSeeds(input()));

  assert.match(markdown, /# Trace Cluster Seeds/);
  assert.match(markdown, /TCS-001/);
  assert.match(markdown, /string rewriting/);
  assert.match(markdown, /Cluster seed only; not a proven pattern/);
  assert.match(markdown, /Vocabulary hints are speculative/);
});

test("trace-cluster-seeds command writes json and markdown", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-trace-cluster-seeds-"));

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "trace_atlas.json"), `${JSON.stringify(input().traceAtlas, null, 2)}\n`, "utf8");
    await writeFile(join(dir, "research_vocabulary_hints.json"), `${JSON.stringify(input().researchVocabularyHints, null, 2)}\n`, "utf8");

    const result = await runTraceClusterSeeds({ experimentsDir: dir, quiet: true });
    const json = JSON.parse(await readFile(join(dir, "trace_cluster_seeds.json"), "utf8"));
    const markdown = await readFile(join(dir, "trace_cluster_seeds.md"), "utf8");

    assert.deepEqual(result, { generated: true, message: "Generated Trace Cluster Seeds for 2 seed(s)." });
    assert.equal(json.seedCount, 2);
    assert.match(markdown, /Trace Cluster Seeds/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("trace-cluster-seeds command reports missing inputs gracefully", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-trace-cluster-missing-"));

  try {
    const result = await runTraceClusterSeeds({ experimentsDir: dir, quiet: true });
    assert.equal(result.generated, false);
    assert.match(result.message, /No trace_atlas.json or research_vocabulary_hints.json found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("trace-cluster-seeds CLI parser supports help and experiments dir", () => {
  assert.deepEqual(parseTraceClusterSeedsArgs([]), {});
  assert.deepEqual(parseTraceClusterSeedsArgs(["--help"]), { help: true });
  assert.deepEqual(parseTraceClusterSeedsArgs(["--experiments-dir", "out"]), { experimentsDir: "out" });
});

function input(): TraceClusterSeedInput {
  return {
    traceAtlas: {
      version: "apg-trace-atlas/v0.1",
      generatedAt: "deterministic:3",
      experimentCount: 3,
      translationDecisionCounts: { translate: 2, do_not_translate: 1 },
      reasonCounts: { "basin diversity": 2, "rule pulse concentration": 1 },
      ruleFamilies: [
        { dominantRuleId: "R3", experimentIds: ["APG-0001", "APG-0002"], count: 2, averageHumanInterestScore: 0.78 },
        { dominantRuleId: "R5", experimentIds: ["APG-0003"], count: 1, averageHumanInterestScore: 0.32 }
      ],
      translationCandidates: [
        {
          experimentId: "APG-0001",
          humanInterestScore: 0.82,
          decision: "translate",
          dominantRuleId: "R3",
          basinCount: 5,
          reasons: ["basin diversity", "rule pulse concentration"]
        },
        {
          experimentId: "APG-0002",
          humanInterestScore: 0.74,
          decision: "translate",
          dominantRuleId: "R3",
          basinCount: 4,
          reasons: ["basin diversity"]
        }
      ],
      quietTraces: [
        {
          experimentId: "APG-0003",
          humanInterestScore: 0.32,
          decision: "do_not_translate",
          dominantRuleId: "R5",
          basinCount: 2,
          reasons: ["low score contrast"]
        }
      ],
      cautions: []
    },
    researchVocabularyHints: {
      version: "apg-research-vocabulary-hints/v0.1",
      generatedAt: "deterministic:2:3",
      traceFamilyHints: [
        {
          dominantRuleId: "R3",
          experimentIds: ["APG-0001", "APG-0002"],
          localTraceEvidence: {
            dominantRulePulse: "R3 compression-like",
            recurringReasons: ["basin diversity", "rule pulse concentration"],
            averageHumanInterestScore: 0.78
          },
          possibleVocabularyHints: [
            {
              term: "string rewriting",
              sourceSignalId: "sig-rewrite",
              sourceTitle: "Rewrite vocabulary",
              confidence: "medium",
              status: "translation_vocabulary_only",
              reason: "Vocabulary only."
            },
            {
              term: "attractor basin",
              sourceSignalId: "sig-basin",
              sourceTitle: "Basin vocabulary",
              confidence: "medium",
              status: "translation_vocabulary_only",
              reason: "Vocabulary only."
            }
          ],
          cautions: []
        },
        {
          dominantRuleId: "R5",
          experimentIds: ["APG-0003"],
          localTraceEvidence: {
            dominantRulePulse: "R5 compression-like",
            recurringReasons: ["low score contrast"],
            averageHumanInterestScore: 0.32
          },
          possibleVocabularyHints: [
            {
              term: "graph rewriting",
              sourceSignalId: "sig-graph",
              sourceTitle: "Graph vocabulary",
              confidence: "low",
              status: "translation_vocabulary_only",
              reason: "Vocabulary only."
            }
          ],
          cautions: []
        }
      ],
      aiCreoleHandoff: "",
      cautions: []
    }
  };
}
